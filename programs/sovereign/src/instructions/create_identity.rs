use anchor_lang::prelude::*;
use crate::state::SovereignIdentity;

#[derive(Accounts)]
pub struct CreateIdentity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = SovereignIdentity::SIZE,
        seeds = [b"identity", owner.key().as_ref()],
        bump,
    )]
    pub identity: Account<'info, SovereignIdentity>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateIdentity>) -> Result<()> {
    let identity = &mut ctx.accounts.identity;
    let clock = Clock::get()?;

    identity.owner = ctx.accounts.owner.key();
    identity.created_at = clock.unix_timestamp;

    // Initialize authorities to owner (can be changed later)
    identity.trading_authority = ctx.accounts.owner.key();
    identity.civic_authority = ctx.accounts.owner.key();
    identity.developer_authority = ctx.accounts.owner.key();
    identity.infra_authority = ctx.accounts.owner.key();

    // Initialize all scores to 0
    identity.trading_score = 0;
    identity.civic_score = 0;
    identity.developer_score = 0;
    identity.infra_score = 0;

    // Initial composite and tier
    identity.composite_score = 0;
    identity.tier = 1;

    identity.last_updated = clock.unix_timestamp;
    identity.bump = ctx.bumps.identity;

    msg!("Created SOVEREIGN identity for {}", ctx.accounts.owner.key());

    Ok(())
}
