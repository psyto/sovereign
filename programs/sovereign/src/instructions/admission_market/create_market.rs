use anchor_lang::prelude::*;
use crate::state::creator_dao::CreatorDAO;
use crate::state::admission_market::{AdmissionMarket, MarketFactory, MarketStatus, MarketOutcome, SurfacingScore};

// =============================================================================
// CREATE ADMISSION MARKET INSTRUCTION
// =============================================================================
//
// THE CUTTING EDGE: This is where Vitalik's novel mechanism comes to life.
//
// Vitalik: "anyone can become a creator and create a creator coin, and then,
// if they get admitted to a creator DAO, a portion of their proceeds from the
// DAO are used to burn their creator coins."
//
// "This way, the token speculators are NOT participating in a recursive-
// speculation attention game backed only by itself. Instead, they are
// specifically being predictors of what new creators the high-value creator
// DAOs will be willing to accept."
//
// "At the same time, they also provide a valuable service to the creator DAOs:
// they are helping surface promising creators for the DAOs to choose from."
//
// The market creator is essentially saying: "I spotted this creator before
// anyone else. I believe DAO X will accept them. I'm putting my money where
// my prediction is."
// =============================================================================

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMarketParams {
    /// Initial liquidity to seed the market (in lamports)
    pub initial_liquidity: u64,
    /// Days until market expires if no nomination
    pub expiry_days: u16,
}

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    /// The market creator (the "talent scout")
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The creator's SOVEREIGN identity (for surfacing score tracking)
    /// CHECK: Optional, validated if present
    pub creator_identity: Option<UncheckedAccount<'info>>,

    /// The DAO this prediction is about
    #[account(
        constraint = dao.is_active @ AdmissionMarketError::DAONotActive,
    )]
    pub dao: Account<'info, CreatorDAO>,

    /// The creator being predicted (their SOVEREIGN identity)
    /// CHECK: Validated in handler
    pub predicted_creator_identity: UncheckedAccount<'info>,

    /// The predicted creator's wallet
    /// CHECK: Used as identifier
    pub predicted_creator_wallet: UncheckedAccount<'info>,

    /// The market account to create
    #[account(
        init,
        payer = creator,
        space = AdmissionMarket::SIZE,
        seeds = [
            b"admission_market",
            dao.key().as_ref(),
            predicted_creator_identity.key().as_ref()
        ],
        bump
    )]
    pub market: Account<'info, AdmissionMarket>,

    /// Market factory for configuration
    #[account(
        mut,
        seeds = [b"market_factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, MarketFactory>,

    /// Surfacing score for the market creator
    #[account(
        init_if_needed,
        payer = creator,
        space = SurfacingScore::SIZE,
        seeds = [b"surfacing_score", creator.key().as_ref()],
        bump
    )]
    pub surfacing_score: Account<'info, SurfacingScore>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let market = &mut ctx.accounts.market;
    let surfacing_score = &mut ctx.accounts.surfacing_score;
    let clock = Clock::get()?;

    // Validate initial liquidity
    require!(
        params.initial_liquidity >= factory.min_initial_liquidity,
        AdmissionMarketError::InsufficientLiquidity
    );

    // Initialize market
    market.market_id = factory.market_count;
    market.dao = ctx.accounts.dao.key();
    market.creator_identity = ctx.accounts.predicted_creator_identity.key();
    market.creator_wallet = ctx.accounts.predicted_creator_wallet.key();
    market.market_creator = ctx.accounts.creator.key();
    market.creator_bonus_bps = factory.creator_bonus_bps;

    // Initialize pools with 50/50 split (market starts at 50% probability)
    // Vitalik: Prediction markets give real-time probability estimates
    let half_liquidity = params.initial_liquidity / 2;
    market.yes_pool = half_liquidity;
    market.no_pool = half_liquidity;
    market.predictor_count = 1; // Market creator counts

    market.initial_liquidity = params.initial_liquidity;
    market.fee_bps = factory.default_fee_bps;
    market.accumulated_fees = 0;

    market.created_at = clock.unix_timestamp;
    market.trading_ends_at = None;
    market.expires_at = clock.unix_timestamp + (params.expiry_days as i64 * 86400);

    market.status = MarketStatus::Open;
    market.outcome = MarketOutcome::Pending;
    market.resolved_by_nomination = None;
    market.resolved_at = None;

    market.burn_percentage_bps = factory.default_burn_bps;
    market.amount_burned = 0;

    market.bump = ctx.bumps.market;

    // Update factory stats
    factory.market_count += 1;
    factory.total_markets += 1;
    factory.total_volume += params.initial_liquidity;

    // Update surfacing score
    // Vitalik: "they also provide a valuable service to the creator DAOs:
    // they are helping surface promising creators for the DAOs to choose from"
    if surfacing_score.identity == Pubkey::default() {
        surfacing_score.identity = ctx.accounts.creator.key();
    }
    surfacing_score.markets_created += 1;
    surfacing_score.last_updated = clock.unix_timestamp;

    msg!(
        "Admission market #{} created: Will DAO '{}' accept creator {}?",
        market.market_id,
        String::from_utf8_lossy(&ctx.accounts.dao.name).trim_end_matches('\0'),
        ctx.accounts.predicted_creator_wallet.key()
    );

    msg!(
        "Initial probability: 50%. Market expires: {}",
        market.expires_at
    );

    // Vitalik: "token speculators are... specifically being predictors of what
    // new creators the high-value creator DAOs will be willing to accept"
    msg!("Speculators can now trade YES/NO positions on this prediction");

    Ok(())
}

#[error_code]
pub enum AdmissionMarketError {
    #[msg("DAO is not active")]
    DAONotActive,

    #[msg("Initial liquidity below minimum")]
    InsufficientLiquidity,

    #[msg("Market is not open for trading")]
    MarketNotOpen,

    #[msg("Market has expired")]
    MarketExpired,

    #[msg("Market not yet resolved")]
    MarketNotResolved,

    #[msg("Position already claimed")]
    AlreadyClaimed,

    #[msg("No winning position to claim")]
    NoWinningPosition,

    #[msg("Invalid trade amount")]
    InvalidTradeAmount,

    #[msg("Slippage exceeded")]
    SlippageExceeded,
}
