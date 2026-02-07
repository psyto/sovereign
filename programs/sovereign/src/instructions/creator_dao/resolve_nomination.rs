use anchor_lang::prelude::*;
use crate::state::creator_dao::{CreatorDAO, DAOMembership, Nomination, CreatorScoreDetails};
use crate::state::admission_market::{AdmissionMarket, MarketStatus, MarketOutcome};
use crate::state::SovereignIdentity;
use crate::instructions::creator_dao::create_dao::CreatorDAOError;

// =============================================================================
// RESOLVE NOMINATION INSTRUCTION
// =============================================================================
//
// This is where Vitalik's vision comes together:
//
// 1. The DAO vote resolves → determines if creator is accepted
// 2. If accepted → creator's SOVEREIGN score increases
// 3. Linked prediction markets resolve → speculators get paid/lose
// 4. A portion of winnings → burned (deflationary pressure)
//
// Vitalik: "the ultimate decider of who rises and falls is not speculators,
// but high-value content creators (we make the assumption that good creators
// are also good judges of quality, which seems often true)"
// =============================================================================

#[derive(Accounts)]
pub struct ResolveNomination<'info> {
    /// Anyone can trigger resolution after voting ends
    #[account(mut)]
    pub resolver: Signer<'info>,

    /// The DAO
    #[account(
        mut,
        constraint = dao.is_active @ CreatorDAOError::DAONotActive,
    )]
    pub dao: Account<'info, CreatorDAO>,

    /// The nomination to resolve
    #[account(
        mut,
        constraint = nomination.dao == dao.key(),
        constraint = !nomination.is_resolved @ CreatorDAOError::AlreadyResolved,
    )]
    pub nomination: Account<'info, Nomination>,

    /// The nominee's SOVEREIGN identity (to update creator score)
    #[account(
        mut,
        constraint = nominee_identity.owner == nomination.nominee_wallet,
    )]
    pub nominee_identity: Account<'info, SovereignIdentity>,

    /// The nominee's creator score details
    #[account(
        mut,
        constraint = creator_score.identity == nominee_identity.key(),
    )]
    pub creator_score: Account<'info, CreatorScoreDetails>,

    /// The nominator's membership (to update nomination stats)
    #[account(
        mut,
        constraint = nominator_membership.dao == dao.key(),
        constraint = nominator_membership.member_wallet == nomination.nominator,
    )]
    pub nominator_membership: Account<'info, DAOMembership>,

    /// Optional: Linked prediction market to resolve
    /// CHECK: Validated in handler
    pub prediction_market: Option<Account<'info, AdmissionMarket>>,

    /// New membership account if accepted
    #[account(
        init_if_needed,
        payer = resolver,
        space = DAOMembership::SIZE,
        seeds = [
            b"dao_membership",
            dao.key().as_ref(),
            nomination.nominee_wallet.as_ref()
        ],
        bump
    )]
    pub new_membership: Account<'info, DAOMembership>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ResolveNomination>) -> Result<()> {
    let clock = Clock::get()?;
    let dao = &mut ctx.accounts.dao;
    let nomination = &mut ctx.accounts.nomination;
    let creator_score = &mut ctx.accounts.creator_score;
    let nominator_membership = &mut ctx.accounts.nominator_membership;
    let nominee_identity = &mut ctx.accounts.nominee_identity;

    // Verify voting period has ended
    require!(
        clock.unix_timestamp > nomination.voting_ends_at,
        CreatorDAOError::VotingNotEnded
    );

    // Check quorum
    require!(
        nomination.has_quorum(dao.quorum),
        CreatorDAOError::QuorumNotReached
    );

    // Determine outcome
    let was_accepted = nomination.meets_threshold(dao.admission_threshold);

    // Update nomination
    nomination.is_resolved = true;
    nomination.was_accepted = was_accepted;
    nomination.resolved_at = Some(clock.unix_timestamp);

    // Update DAO state
    dao.pending_nominations = dao.pending_nominations.saturating_sub(1);

    if was_accepted {
        // === CREATOR ACCEPTED ===
        // Vitalik: "if they get admitted to a creator DAO..."

        dao.total_admitted += 1;
        dao.member_count += 1;

        // Initialize new membership
        let new_membership = &mut ctx.accounts.new_membership;
        new_membership.dao = dao.key();
        new_membership.member_identity = nomination.nominee_identity;
        new_membership.member_wallet = nomination.nominee_wallet;
        new_membership.admitted_at = clock.unix_timestamp;
        new_membership.nominated_by = Some(nomination.nominator);
        new_membership.successful_nominations = 0;
        new_membership.votes_cast = 0;
        new_membership.is_active = true;
        new_membership.bump = ctx.bumps.new_membership;

        // Update nominator stats (they made a successful nomination)
        nominator_membership.successful_nominations += 1;

        // === UPDATE SOVEREIGN CREATOR SCORE ===
        // This is the core value proposition

        creator_score.daos_accepted += 1;
        if creator_score.first_dao_acceptance.is_none() {
            creator_score.first_dao_acceptance = Some(clock.unix_timestamp);
        }

        // Award reputation points based on DAO tier/prestige
        // Higher member count = more established = more prestige
        let prestige_bonus = match dao.member_count {
            0..=10 => 100,      // New DAO
            11..=50 => 200,     // Growing DAO
            51..=100 => 300,    // Established DAO
            101..=150 => 400,   // Prestigious DAO
            _ => 500,           // Elite DAO
        };
        creator_score.dao_reputation_points += prestige_bonus;
        creator_score.last_updated = clock.unix_timestamp;

        // Recalculate creator score
        let new_score = creator_score.calculate_score();

        // Update SOVEREIGN identity with new creator score
        // Note: This requires adding creator_score and creator_authority to SovereignIdentity
        // For now, we log the score
        msg!(
            "Creator {} accepted into DAO '{}'. New creator score: {}",
            nomination.nominee_wallet,
            String::from_utf8_lossy(&dao.name).trim_end_matches('\0'),
            new_score
        );

        // Vitalik: "If N gets above ~200, consider auto-splitting it"
        if dao.should_consider_split() {
            msg!(
                "WARNING: DAO now has {} members. Consider splitting.",
                dao.member_count
            );
        }

    } else {
        // === CREATOR REJECTED ===
        dao.total_removed += 1;

        // Update nominator stats (failed nomination)
        // This affects their judgment quality score
        creator_score.failed_nominations += 1;

        msg!(
            "Creator {} rejected by DAO '{}'. Votes: {} accept, {} reject",
            nomination.nominee_wallet,
            String::from_utf8_lossy(&dao.name).trim_end_matches('\0'),
            nomination.votes_accept,
            nomination.votes_reject
        );
    }

    // === RESOLVE LINKED PREDICTION MARKET ===
    // Vitalik: "the token speculators are NOT participating in a recursive-
    // speculation attention game backed only by itself. Instead, they are
    // specifically being predictors of what new creators the high-value
    // creator DAOs will be willing to accept"

    if let Some(market) = &mut ctx.accounts.prediction_market {
        // Verify market is for this nomination
        if market.dao == dao.key() && market.creator_identity == nomination.nominee_identity {
            market.status = MarketStatus::Resolved;
            market.outcome = if was_accepted {
                MarketOutcome::Accepted
            } else {
                MarketOutcome::Rejected
            };
            market.resolved_by_nomination = Some(nomination.key());
            market.resolved_at = Some(clock.unix_timestamp);

            // Calculate burn amount
            // Vitalik: "a portion of their proceeds from the DAO are used to
            // burn their creator coins"
            let total_pool = market.yes_pool + market.no_pool;
            let burn_amount = (total_pool as u128 * market.burn_percentage_bps as u128 / 10000) as u64;
            market.amount_burned = burn_amount;

            msg!(
                "Prediction market resolved: {}. {} tokens will be burned.",
                if was_accepted { "ACCEPTED" } else { "REJECTED" },
                burn_amount
            );

            // Update creator's burn metrics
            creator_score.total_burned += burn_amount;
        }
    }

    // Update nominator's judgment accuracy
    let total_nominations = nominator_membership.successful_nominations as u32 +
        creator_score.failed_nominations as u32;
    if total_nominations > 0 {
        let accuracy = (nominator_membership.successful_nominations as u32 * 10000) / total_nominations;
        // This accuracy feeds back into the nominator's own creator score
        msg!("Nominator judgment accuracy: {}%", accuracy / 100);
    }

    Ok(())
}
