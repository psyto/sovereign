use anchor_lang::prelude::*;
use crate::state::SovereignIdentity;
use crate::errors::SovereignError;

// =============================================================================
// UPDATE CREATOR SCORE INSTRUCTION
// =============================================================================
//
// Updates the creator dimension of a SOVEREIGN identity.
//
// Unlike other dimensions where a single oracle updates the score, the Creator
// dimension is updated by the CreatorDAO program based on:
// - DAO acceptances (primary signal)
// - Judgment quality (nomination accuracy)
// - Prediction market performance (surfacing accuracy)
//
// Vitalik: "the ultimate decider of who rises and falls is not speculators,
// but high-value content creators (we make the assumption that good creators
// are also good judges of quality, which seems often true)"
// =============================================================================

#[derive(Accounts)]
pub struct UpdateCreatorScore<'info> {
    /// The authority (CreatorDAO program or delegated authority)
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = identity.creator_authority == authority.key() @ SovereignError::Unauthorized,
    )]
    pub identity: Account<'info, SovereignIdentity>,
}

pub fn handler(ctx: Context<UpdateCreatorScore>, score: u16) -> Result<()> {
    require!(score <= 10000, SovereignError::InvalidScore);

    let identity = &mut ctx.accounts.identity;
    identity.creator_score = score;
    identity.last_updated = Clock::get()?.unix_timestamp;
    identity.recalculate();

    msg!(
        "Updated creator score to {} (composite: {}, tier: {})",
        score,
        identity.composite_score,
        identity.tier
    );

    // Vitalik: Creator score reflects acceptance by peer DAOs, not speculation
    msg!("Creator reputation derived from DAO peer judgment, not attention metrics");

    Ok(())
}
