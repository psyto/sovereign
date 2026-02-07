use anchor_lang::prelude::*;
use crate::state::creator_dao::{CreatorDAO, DAOMembership, MAX_DAO_MEMBERS};
use crate::instructions::creator_dao::create_dao::CreatorDAOError;

// =============================================================================
// ADD FOUNDER MEMBER INSTRUCTION
// =============================================================================
//
// Vitalik: "Hand-pick the initial membership set, in order to maximize its
// alignment with the desired style."
//
// Only the founder can add initial members. This is the "hand-picking" phase.
// After initial setup, members can only be added via nomination/voting.
// =============================================================================

#[derive(Accounts)]
pub struct AddFounderMember<'info> {
    /// The founder (must match DAO founder)
    #[account(
        mut,
        constraint = dao.founder == founder.key() @ CreatorDAOError::NotFounder,
    )]
    pub founder: Signer<'info>,

    /// The DAO
    #[account(
        mut,
        constraint = dao.is_active @ CreatorDAOError::DAONotActive,
        constraint = (dao.member_count as usize) < MAX_DAO_MEMBERS @ CreatorDAOError::MaxMembersReached,
    )]
    pub dao: Account<'info, CreatorDAO>,

    /// The new member's SOVEREIGN identity
    /// CHECK: Will be validated exists
    pub member_identity: UncheckedAccount<'info>,

    /// The new member's wallet
    /// CHECK: Used as identifier
    pub member_wallet: UncheckedAccount<'info>,

    /// New membership account
    #[account(
        init,
        payer = founder,
        space = DAOMembership::SIZE,
        seeds = [
            b"dao_membership",
            dao.key().as_ref(),
            member_wallet.key().as_ref()
        ],
        bump
    )]
    pub membership: Account<'info, DAOMembership>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddFounderMember>) -> Result<()> {
    let dao = &mut ctx.accounts.dao;
    let membership = &mut ctx.accounts.membership;
    let clock = Clock::get()?;

    // Initialize membership
    membership.dao = dao.key();
    membership.member_identity = ctx.accounts.member_identity.key();
    membership.member_wallet = ctx.accounts.member_wallet.key();
    membership.admitted_at = clock.unix_timestamp;
    membership.nominated_by = None; // Founder-added, no nominator
    membership.successful_nominations = 0;
    membership.votes_cast = 0;
    membership.is_active = true;
    membership.bump = ctx.bumps.membership;

    // Update DAO member count
    dao.member_count += 1;

    msg!(
        "Founder added member {} to DAO '{}'. Total members: {}",
        ctx.accounts.member_wallet.key(),
        String::from_utf8_lossy(&dao.name).trim_end_matches('\0'),
        dao.member_count
    );

    // Vitalik: "Hand-pick the initial membership set, in order to maximize its
    // alignment with the desired style"
    if dao.member_count >= 5 {
        msg!("Recommended: Consider finalizing founder phase and enabling nominations");
    }

    Ok(())
}
