use anchor_lang::prelude::*;
use crate::state::admission_market::{AdmissionMarket, MarketPosition, MarketStatus};
use crate::instructions::admission_market::create_market::AdmissionMarketError;

// =============================================================================
// TAKE POSITION INSTRUCTION
// =============================================================================
//
// Vitalik: "the token speculators are NOT participating in a recursive-
// speculation attention game backed only by itself. Instead, they are
// specifically being predictors of what new creators the high-value creator
// DAOs will be willing to accept."
//
// Speculators take YES or NO positions:
// - YES = "I predict this creator WILL be accepted by this DAO"
// - NO = "I predict this creator will NOT be accepted"
//
// The key insight: the resolution oracle is NOT attention metrics.
// It's the actual vote of the DAO members (quality judges).
// =============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum PositionSide {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TakePositionParams {
    /// Amount to stake (in lamports)
    pub amount: u64,
    /// Which side to take
    pub side: PositionSide,
    /// Minimum tokens to receive (slippage protection)
    pub min_tokens: u64,
}

#[derive(Accounts)]
#[instruction(params: TakePositionParams)]
pub struct TakePosition<'info> {
    /// The predictor
    #[account(mut)]
    pub predictor: Signer<'info>,

    /// The predictor's SOVEREIGN identity (for prediction accuracy tracking)
    /// CHECK: Optional
    pub predictor_identity: Option<UncheckedAccount<'info>>,

    /// The market
    #[account(
        mut,
        constraint = market.status == MarketStatus::Open @ AdmissionMarketError::MarketNotOpen,
    )]
    pub market: Account<'info, AdmissionMarket>,

    /// The predictor's position
    #[account(
        init_if_needed,
        payer = predictor,
        space = MarketPosition::SIZE,
        seeds = [
            b"market_position",
            market.key().as_ref(),
            predictor.key().as_ref()
        ],
        bump
    )]
    pub position: Account<'info, MarketPosition>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<TakePosition>, params: TakePositionParams) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // Check market hasn't expired
    require!(
        clock.unix_timestamp < market.expires_at,
        AdmissionMarketError::MarketExpired
    );

    // Check minimum amount
    require!(
        params.amount > 0,
        AdmissionMarketError::InvalidTradeAmount
    );

    // Calculate tokens based on constant product AMM
    let tokens = match params.side {
        PositionSide::Yes => market.calculate_yes_tokens(params.amount, market.fee_bps),
        PositionSide::No => market.calculate_no_tokens(params.amount, market.fee_bps),
    };

    // Slippage check
    require!(
        tokens >= params.min_tokens,
        AdmissionMarketError::SlippageExceeded
    );

    // Calculate fee
    let fee = params.amount * market.fee_bps as u64 / 10000;
    let amount_after_fee = params.amount - fee;

    // Update market pools
    match params.side {
        PositionSide::Yes => {
            market.no_pool += amount_after_fee;
            market.yes_pool = market.yes_pool.saturating_sub(tokens);
        }
        PositionSide::No => {
            market.yes_pool += amount_after_fee;
            market.no_pool = market.no_pool.saturating_sub(tokens);
        }
    }
    market.accumulated_fees += fee;

    // Initialize or update position
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.predictor = ctx.accounts.predictor.key();
        position.predictor_identity = ctx.accounts.predictor_identity
            .as_ref()
            .map(|a| a.key());
        position.yes_tokens = 0;
        position.no_tokens = 0;
        position.total_staked = 0;
        position.opened_at = clock.unix_timestamp;
        position.claimed = false;
        position.payout = 0;
        position.bump = ctx.bumps.position;

        // New predictor
        market.predictor_count += 1;
    }

    // Add tokens to position
    match params.side {
        PositionSide::Yes => position.yes_tokens += tokens,
        PositionSide::No => position.no_tokens += tokens,
    }
    position.total_staked += params.amount;
    position.last_modified = clock.unix_timestamp;

    // Log current market state
    let yes_prob = market.yes_price_bps();
    let no_prob = market.no_price_bps();

    msg!(
        "Position taken: {} {} tokens for {} lamports",
        tokens,
        match params.side { PositionSide::Yes => "YES", PositionSide::No => "NO" },
        params.amount
    );

    msg!(
        "Market probability updated: {}% YES, {}% NO",
        yes_prob / 100,
        no_prob / 100
    );

    // Vitalik insight: The price movement reflects collective intelligence
    // about whether the DAO will accept this creator
    if yes_prob > 7000 {
        msg!("Market strongly predicts ACCEPTANCE (>70%)");
    } else if no_prob > 7000 {
        msg!("Market strongly predicts REJECTION (>70%)");
    }

    Ok(())
}
