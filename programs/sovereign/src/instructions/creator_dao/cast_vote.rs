use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use crate::state::creator_dao::{CreatorDAO, DAOMembership, Nomination, VoteRecord, VoteChoice};
use crate::instructions::creator_dao::create_dao::CreatorDAOError;

// =============================================================================
// CAST VOTE INSTRUCTION
// =============================================================================
//
// Vitalik: "there are N members, and they can (anonymously) vote new members
// in and out"
//
// Current implementation: Semi-anonymous (hides vote choice but not participation)
// For full anonymity: Integrate with VEIL's ZK infrastructure
// =============================================================================

#[derive(Accounts)]
pub struct CastVote<'info> {
    /// The voter (must be existing DAO member)
    #[account(mut)]
    pub voter: Signer<'info>,

    /// The voter's membership account
    #[account(
        mut,
        constraint = voter_membership.dao == dao.key() @ CreatorDAOError::NotMember,
        constraint = voter_membership.member_wallet == voter.key() @ CreatorDAOError::NotMember,
        constraint = voter_membership.is_active @ CreatorDAOError::NotMember,
    )]
    pub voter_membership: Account<'info, DAOMembership>,

    /// The DAO
    #[account(
        constraint = dao.is_active @ CreatorDAOError::DAONotActive,
    )]
    pub dao: Account<'info, CreatorDAO>,

    /// The nomination being voted on
    #[account(
        mut,
        constraint = nomination.dao == dao.key(),
        constraint = !nomination.is_resolved @ CreatorDAOError::AlreadyResolved,
    )]
    pub nomination: Account<'info, Nomination>,

    /// Vote record (prevents double voting)
    #[account(
        init,
        payer = voter,
        space = VoteRecord::SIZE,
        seeds = [
            b"vote_record",
            nomination.key().as_ref(),
            voter.key().as_ref()
        ],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CastVote>, vote: VoteChoice, salt: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;
    let nomination = &mut ctx.accounts.nomination;
    let vote_record = &mut ctx.accounts.vote_record;
    let voter_membership = &mut ctx.accounts.voter_membership;

    // Check voting period
    require!(
        clock.unix_timestamp <= nomination.voting_ends_at,
        CreatorDAOError::VotingEnded
    );

    // Create voter hash for semi-anonymity
    // Vitalik: "(anonymously) vote"
    // This hides WHO voted HOW, but not that they voted
    // For full ZK anonymity, integrate VEIL
    let voter_hash = keccak::hashv(&[
        ctx.accounts.voter.key().as_ref(),
        &nomination.nomination_id.to_le_bytes(),
        &salt,
    ]);

    // Record vote
    vote_record.nomination = nomination.key();
    vote_record.voter_hash = voter_hash.0;
    vote_record.vote = vote;
    vote_record.voted_at = clock.unix_timestamp;
    vote_record.bump = ctx.bumps.vote_record;

    // Update nomination tallies
    match vote {
        VoteChoice::Accept => nomination.votes_accept += 1,
        VoteChoice::Reject => nomination.votes_reject += 1,
        VoteChoice::Abstain => nomination.votes_abstain += 1,
    }

    // Update voter stats
    voter_membership.votes_cast += 1;

    msg!(
        "Vote cast on nomination #{}. Current tally: {} accept, {} reject, {} abstain",
        nomination.nomination_id,
        nomination.votes_accept,
        nomination.votes_reject,
        nomination.votes_abstain
    );

    // Vitalik: "the ultimate decider of who rises and falls is not speculators,
    // but high-value content creators"
    let total_votes = nomination.votes_accept + nomination.votes_reject + nomination.votes_abstain;
    let participation_pct = if nomination.total_members_snapshot > 0 {
        (total_votes as u32 * 100) / nomination.total_members_snapshot as u32
    } else {
        0
    };
    msg!("Participation: {}% of members have voted", participation_pct);

    Ok(())
}
