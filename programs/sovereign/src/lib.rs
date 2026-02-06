use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T");

#[program]
pub mod sovereign {
    use super::*;

    // === Identity Management ===

    /// Create a new SOVEREIGN identity for the signer
    pub fn create_identity(ctx: Context<CreateIdentity>) -> Result<()> {
        instructions::create_identity::handler(ctx)
    }

    // === Authority Management ===

    /// Set the authority that can update trading scores
    pub fn set_trading_authority(
        ctx: Context<SetAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::set_authority::set_trading_authority(ctx, new_authority)
    }

    /// Set the authority that can update civic scores
    pub fn set_civic_authority(
        ctx: Context<SetAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::set_authority::set_civic_authority(ctx, new_authority)
    }

    /// Set the authority that can update developer scores
    pub fn set_developer_authority(
        ctx: Context<SetAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::set_authority::set_developer_authority(ctx, new_authority)
    }

    /// Set the authority that can update infrastructure scores
    pub fn set_infra_authority(
        ctx: Context<SetAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::set_authority::set_infra_authority(ctx, new_authority)
    }

    // === Score Updates ===

    /// Update trading score
    pub fn update_trading_score(
        ctx: Context<UpdateTradingScore>,
        score: u16,
    ) -> Result<()> {
        instructions::update_trading::handler(ctx, score)
    }

    /// Update civic score
    pub fn update_civic_score(
        ctx: Context<UpdateCivicScore>,
        score: u16,
    ) -> Result<()> {
        instructions::update_civic::handler(ctx, score)
    }

    /// Update developer score
    pub fn update_developer_score(
        ctx: Context<UpdateDeveloperScore>,
        score: u16,
    ) -> Result<()> {
        instructions::update_developer::handler(ctx, score)
    }

    /// Update infrastructure score
    pub fn update_infra_score(
        ctx: Context<UpdateInfraScore>,
        score: u16,
    ) -> Result<()> {
        instructions::update_infra::handler(ctx, score)
    }
}
