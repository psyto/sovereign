use anchor_lang::prelude::*;
use crate::state::creator_dao::{CreatorDAO, DAOMembership, Nomination, MAX_PENDING_NOMINATIONS};
use crate::instructions::creator_dao::create_dao::CreatorDAOError;

// =============================================================================
// NOMINATE CREATOR INSTRUCTION
// =============================================================================
//
// Vitalik: "anyone can become a creator and create a creator coin, and then,
// if they get admitted to a creator DAO..."
//
// Any existing DAO member can nominate a creator for admission.
// This triggers the voting process.
// =============================================================================

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct NominateCreatorParams {
    /// Reason for nomination (max 256 chars)
    pub reason: String,
}

#[derive(Accounts)]
#[instruction(params: NominateCreatorParams)]
pub struct NominateCreator<'info> {
    /// The nominator (must be existing DAO member)
    #[account(mut)]
    pub nominator: Signer<'info>,

    /// The nominator's membership account
    #[account(
        constraint = nominator_membership.dao == dao.key() @ CreatorDAOError::NotMember,
        constraint = nominator_membership.member_wallet == nominator.key() @ CreatorDAOError::NotMember,
        constraint = nominator_membership.is_active @ CreatorDAOError::NotMember,
    )]
    pub nominator_membership: Account<'info, DAOMembership>,

    /// The DAO
    #[account(
        mut,
        constraint = dao.is_active @ CreatorDAOError::DAONotActive,
        constraint = dao.pending_nominations < MAX_PENDING_NOMINATIONS as u8 @ CreatorDAOError::MaxPendingNominations,
    )]
    pub dao: Account<'info, CreatorDAO>,

    /// The nominee's SOVEREIGN identity
    /// CHECK: Will be validated
    pub nominee_identity: UncheckedAccount<'info>,

    /// The nominee's wallet
    /// CHECK: Used as identifier
    pub nominee_wallet: UncheckedAccount<'info>,

    /// The nomination account to create
    #[account(
        init,
        payer = nominator,
        space = Nomination::SIZE,
        seeds = [
            b"nomination",
            dao.key().as_ref(),
            &dao.nomination_nonce.to_le_bytes()
        ],
        bump
    )]
    pub nomination: Account<'info, Nomination>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<NominateCreator>, params: NominateCreatorParams) -> Result<()> {
    let dao = &mut ctx.accounts.dao;
    let nomination = &mut ctx.accounts.nomination;
    let clock = Clock::get()?;

    // Convert reason to fixed array
    let mut reason_bytes = [0u8; 256];
    let reason_slice = params.reason.as_bytes();
    let reason_len = reason_slice.len().min(256);
    reason_bytes[..reason_len].copy_from_slice(&reason_slice[..reason_len]);

    // Initialize nomination
    nomination.dao = dao.key();
    nomination.nomination_id = dao.nomination_nonce;
    nomination.nominee_identity = ctx.accounts.nominee_identity.key();
    nomination.nominee_wallet = ctx.accounts.nominee_wallet.key();
    nomination.nominator = ctx.accounts.nominator.key();
    nomination.reason = reason_bytes;
    nomination.created_at = clock.unix_timestamp;
    nomination.voting_ends_at = clock.unix_timestamp + dao.voting_period;
    nomination.votes_accept = 0;
    nomination.votes_reject = 0;
    nomination.votes_abstain = 0;
    nomination.total_members_snapshot = dao.member_count;
    nomination.is_resolved = false;
    nomination.was_accepted = false;
    nomination.resolved_at = None;
    nomination.bump = ctx.bumps.nomination;

    // Update DAO state
    dao.nomination_nonce += 1;
    dao.pending_nominations += 1;

    msg!(
        "Nomination #{} created for admission to DAO '{}'. Voting ends at {}",
        nomination.nomination_id,
        String::from_utf8_lossy(&dao.name).trim_end_matches('\0'),
        nomination.voting_ends_at
    );

    // Vitalik: "they are helping surface promising creators for the DAOs to choose from"
    // This nomination may have been influenced by prediction market activity
    msg!("Prediction markets can now lock in positions for this nomination");

    Ok(())
}
