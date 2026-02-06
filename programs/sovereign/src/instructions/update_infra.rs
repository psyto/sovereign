use anchor_lang::prelude::*;
use crate::state::SovereignIdentity;
use crate::errors::SovereignError;

#[derive(Accounts)]
pub struct UpdateInfraScore<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = identity.infra_authority == authority.key() @ SovereignError::Unauthorized,
    )]
    pub identity: Account<'info, SovereignIdentity>,
}

pub fn handler(ctx: Context<UpdateInfraScore>, score: u16) -> Result<()> {
    require!(score <= 10000, SovereignError::InvalidScore);

    let identity = &mut ctx.accounts.identity;
    identity.infra_score = score;
    identity.last_updated = Clock::get()?.unix_timestamp;
    identity.recalculate();

    msg!(
        "Updated infra score to {} (composite: {}, tier: {})",
        score,
        identity.composite_score,
        identity.tier
    );

    Ok(())
}
