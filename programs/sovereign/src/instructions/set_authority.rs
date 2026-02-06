use anchor_lang::prelude::*;
use crate::state::SovereignIdentity;
use crate::errors::SovereignError;

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"identity", owner.key().as_ref()],
        bump = identity.bump,
        constraint = identity.owner == owner.key() @ SovereignError::OwnerMismatch,
    )]
    pub identity: Account<'info, SovereignIdentity>,
}

pub fn set_trading_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(new_authority != Pubkey::default(), SovereignError::InvalidAuthority);

    let identity = &mut ctx.accounts.identity;
    identity.trading_authority = new_authority;

    msg!("Set trading authority to {}", new_authority);
    Ok(())
}

pub fn set_civic_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(new_authority != Pubkey::default(), SovereignError::InvalidAuthority);

    let identity = &mut ctx.accounts.identity;
    identity.civic_authority = new_authority;

    msg!("Set civic authority to {}", new_authority);
    Ok(())
}

pub fn set_developer_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(new_authority != Pubkey::default(), SovereignError::InvalidAuthority);

    let identity = &mut ctx.accounts.identity;
    identity.developer_authority = new_authority;

    msg!("Set developer authority to {}", new_authority);
    Ok(())
}

pub fn set_infra_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(new_authority != Pubkey::default(), SovereignError::InvalidAuthority);

    let identity = &mut ctx.accounts.identity;
    identity.infra_authority = new_authority;

    msg!("Set infra authority to {}", new_authority);
    Ok(())
}
