use anchor_lang::prelude::*;
use crate::state::SovereignIdentity;
use crate::errors::SovereignError;

#[derive(Accounts)]
pub struct UpdateTradingScore<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = identity.trading_authority == authority.key() @ SovereignError::Unauthorized,
    )]
    pub identity: Account<'info, SovereignIdentity>,
}

pub fn handler(ctx: Context<UpdateTradingScore>, score: u16) -> Result<()> {
    require!(score <= 10000, SovereignError::InvalidScore);

    let identity = &mut ctx.accounts.identity;
    identity.trading_score = score;
    identity.last_updated = Clock::get()?.unix_timestamp;
    identity.recalculate();

    msg!(
        "Updated trading score to {} (composite: {}, tier: {})",
        score,
        identity.composite_score,
        identity.tier
    );

    Ok(())
}
