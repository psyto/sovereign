use anchor_lang::prelude::*;

// =============================================================================
// ADMISSION PREDICTION MARKET
// =============================================================================
//
// The "cutting edge" component from Vitalik's proposal:
//
// "anyone can become a creator and create a creator coin, and then, if they
// get admitted to a creator DAO, a portion of their proceeds from the DAO
// are used to burn their creator coins."
//
// "This way, the token speculators are NOT participating in a recursive-
// speculation attention game backed only by itself. Instead, they are
// specifically being predictors of what new creators the high-value creator
// DAOs will be willing to accept."
//
// "At the same time, they also provide a valuable service to the creator DAOs:
// they are helping surface promising creators for the DAOs to choose from."
//
// Key insight: The resolution oracle is the DAO's vote, not an external feed.
// This grounds speculation in quality judgment rather than attention metrics.
// =============================================================================

/// Market status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    /// Market is open for trading
    Open,
    /// Nomination voting has started, no new positions
    VotingInProgress,
    /// Market resolved, waiting for claims
    Resolved,
    /// All claims processed
    Finalized,
    /// Expired without resolution (nomination withdrawn/expired)
    Expired,
}

/// Outcome of the market
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketOutcome {
    /// Not yet determined
    Pending,
    /// Creator was accepted by the DAO
    Accepted,
    /// Creator was rejected by the DAO
    Rejected,
    /// Invalid/cancelled (refunds)
    Cancelled,
}

// =============================================================================
// ADMISSION MARKET ACCOUNT
// =============================================================================
// Prediction market: "Will DAO X accept Creator Y?"
// Resolution oracle: The DAO's actual vote outcome
// =============================================================================

#[account]
pub struct AdmissionMarket {
    /// Unique market ID
    pub market_id: u64,

    // === The Prediction ===
    /// Which DAO is this prediction about?
    pub dao: Pubkey,
    /// Which creator are we predicting will be accepted?
    pub creator_identity: Pubkey,
    /// The creator's wallet (for potential nomination)
    pub creator_wallet: Pubkey,

    // === Market Creator ===
    /// Who created this market (the speculator who spotted talent first)
    pub market_creator: Pubkey,
    /// Bonus for market creator if prediction is correct (basis points of pool)
    pub creator_bonus_bps: u16,

    // === Pool State ===
    /// Total staked on "will be accepted" (YES)
    pub yes_pool: u64,
    /// Total staked on "will be rejected" (NO)
    pub no_pool: u64,
    /// Total unique predictors
    pub predictor_count: u32,

    // === Pricing (Constant Product AMM) ===
    // Vitalik references prediction markets extensively; using proven AMM model
    // Price of YES = no_pool / (yes_pool + no_pool)
    // This gives real-time probability estimation

    /// Initial liquidity seeded (for calculating LP returns)
    pub initial_liquidity: u64,
    /// Fee taken on each trade (basis points)
    pub fee_bps: u16,
    /// Accumulated fees
    pub accumulated_fees: u64,

    // === Timing ===
    /// When market was created
    pub created_at: i64,
    /// Market closes for new positions when nomination voting starts
    pub trading_ends_at: Option<i64>,
    /// When the market expires if no nomination happens
    pub expires_at: i64,

    // === Resolution ===
    // Vitalik: "the ultimate decider of who rises and falls is not speculators,
    // but high-value content creators"
    // Resolution oracle = the DAO vote outcome

    /// Current status
    pub status: MarketStatus,
    /// Final outcome (only valid when resolved)
    pub outcome: MarketOutcome,
    /// The nomination that resolved this market (if any)
    pub resolved_by_nomination: Option<Pubkey>,
    /// When resolved
    pub resolved_at: Option<i64>,

    // === Burn Integration ===
    // Vitalik: "a portion of their proceeds from the DAO are used to burn
    // their creator coins"

    /// Percentage of winning pool that goes to burn (basis points)
    pub burn_percentage_bps: u16,
    /// Amount sent to burn
    pub amount_burned: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl AdmissionMarket {
    pub const SIZE: usize = 8 +     // discriminator
        8 +                          // market_id
        32 +                         // dao
        32 +                         // creator_identity
        32 +                         // creator_wallet
        32 +                         // market_creator
        2 +                          // creator_bonus_bps
        8 +                          // yes_pool
        8 +                          // no_pool
        4 +                          // predictor_count
        8 +                          // initial_liquidity
        2 +                          // fee_bps
        8 +                          // accumulated_fees
        8 +                          // created_at
        9 +                          // trading_ends_at
        8 +                          // expires_at
        1 +                          // status
        1 +                          // outcome
        33 +                         // resolved_by_nomination
        9 +                          // resolved_at
        2 +                          // burn_percentage_bps
        8 +                          // amount_burned
        1;                           // bump

    /// Calculate current YES price (probability of acceptance)
    /// Returns basis points (0-10000)
    pub fn yes_price_bps(&self) -> u16 {
        if self.yes_pool == 0 && self.no_pool == 0 {
            return 5000; // 50% default
        }
        let total = self.yes_pool + self.no_pool;
        ((self.no_pool as u128 * 10000) / total as u128) as u16
    }

    /// Calculate current NO price
    pub fn no_price_bps(&self) -> u16 {
        10000 - self.yes_price_bps()
    }

    /// Calculate amount of YES tokens for a given stake
    /// Using constant product formula: x * y = k
    pub fn calculate_yes_tokens(&self, stake: u64, fee_bps: u16) -> u64 {
        let stake_after_fee = stake - (stake * fee_bps as u64 / 10000);
        if self.yes_pool == 0 {
            return stake_after_fee;
        }
        // dy = y - (k / (x + dx))
        let k = self.yes_pool as u128 * self.no_pool as u128;
        let new_no_pool = self.no_pool + stake_after_fee;
        let new_yes_pool = (k / new_no_pool as u128) as u64;
        self.yes_pool - new_yes_pool
    }

    /// Calculate amount of NO tokens for a given stake
    pub fn calculate_no_tokens(&self, stake: u64, fee_bps: u16) -> u64 {
        let stake_after_fee = stake - (stake * fee_bps as u64 / 10000);
        if self.no_pool == 0 {
            return stake_after_fee;
        }
        let k = self.yes_pool as u128 * self.no_pool as u128;
        let new_yes_pool = self.yes_pool + stake_after_fee;
        let new_no_pool = (k / new_yes_pool as u128) as u64;
        self.no_pool - new_no_pool
    }

    /// Calculate payout for winning position
    pub fn calculate_payout(&self, position_tokens: u64, is_yes: bool) -> u64 {
        let (winning_pool, losing_pool) = if is_yes {
            (self.yes_pool, self.no_pool)
        } else {
            (self.no_pool, self.yes_pool)
        };

        if winning_pool == 0 {
            return 0;
        }

        // Winner's share of the losing pool
        let total_pot = winning_pool + losing_pool;
        let burn_amount = (total_pot as u128 * self.burn_percentage_bps as u128 / 10000) as u64;
        let distributable = total_pot - burn_amount - self.accumulated_fees;

        (distributable as u128 * position_tokens as u128 / winning_pool as u128) as u64
    }
}

// =============================================================================
// MARKET POSITION ACCOUNT
// =============================================================================
// Individual predictor's position in a market
// =============================================================================

#[account]
pub struct MarketPosition {
    /// The market this position is in
    pub market: Pubkey,
    /// The predictor's wallet
    pub predictor: Pubkey,
    /// The predictor's SOVEREIGN identity (for reputation tracking)
    pub predictor_identity: Option<Pubkey>,

    // === Position ===
    /// Amount of YES tokens held
    pub yes_tokens: u64,
    /// Amount of NO tokens held
    pub no_tokens: u64,
    /// Total amount staked
    pub total_staked: u64,

    // === Tracking ===
    /// When position was opened
    pub opened_at: i64,
    /// When position was last modified
    pub last_modified: i64,
    /// Whether position has been claimed after resolution
    pub claimed: bool,
    /// Payout received (0 if not claimed or lost)
    pub payout: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl MarketPosition {
    pub const SIZE: usize = 8 + 32 + 32 + 33 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;

    /// Calculate unrealized P&L based on current market prices
    pub fn unrealized_pnl(&self, market: &AdmissionMarket) -> i64 {
        let yes_value = self.yes_tokens as u128 * market.yes_price_bps() as u128 / 10000;
        let no_value = self.no_tokens as u128 * market.no_price_bps() as u128 / 10000;
        let current_value = (yes_value + no_value) as i64;
        current_value - self.total_staked as i64
    }
}

// =============================================================================
// MARKET FACTORY ACCOUNT
// =============================================================================
// Global configuration for admission markets
// =============================================================================

#[account]
pub struct MarketFactory {
    /// Authority that can update factory settings
    pub authority: Pubkey,
    /// Counter for unique market IDs
    pub market_count: u64,
    /// Default trading fee (basis points)
    pub default_fee_bps: u16,
    /// Default burn percentage (basis points)
    pub default_burn_bps: u16,
    /// Minimum initial liquidity required
    pub min_initial_liquidity: u64,
    /// Default expiry period (seconds from creation)
    pub default_expiry_period: i64,
    /// Creator bonus for correct prediction (basis points)
    pub creator_bonus_bps: u16,
    /// Total markets created
    pub total_markets: u64,
    /// Total volume across all markets
    pub total_volume: u64,
    /// Total amount burned across all markets
    pub total_burned: u64,
    /// PDA bump
    pub bump: u8,
}

impl MarketFactory {
    pub const SIZE: usize = 8 + 32 + 8 + 2 + 2 + 8 + 8 + 2 + 8 + 8 + 8 + 1;
}

// =============================================================================
// SURFACING LEADERBOARD
// =============================================================================
// Vitalik: "they also provide a valuable service to the creator DAOs: they
// are helping surface promising creators for the DAOs to choose from"
//
// Track which predictors are best at surfacing talent
// =============================================================================

#[account]
pub struct SurfacingScore {
    /// The predictor's SOVEREIGN identity
    pub identity: Pubkey,
    /// Markets created that led to successful admissions
    pub successful_surfaces: u32,
    /// Total markets created
    pub markets_created: u32,
    /// Surfacing accuracy (basis points)
    pub surfacing_accuracy_bps: u16,
    /// Total prediction profit (lamports)
    pub total_profit: i64,
    /// Reputation score for being a good talent scout
    pub scout_score: u16,
    /// Last updated
    pub last_updated: i64,
    /// PDA bump
    pub bump: u8,
}

impl SurfacingScore {
    pub const SIZE: usize = 8 + 32 + 4 + 4 + 2 + 8 + 2 + 8 + 1;

    /// Calculate scout score (0-10000)
    /// Good scouts: high accuracy + high volume + profitable
    pub fn calculate_scout_score(&self) -> u16 {
        if self.markets_created == 0 {
            return 0;
        }

        // Accuracy component (50%)
        let accuracy = self.surfacing_accuracy_bps as u32 * 50 / 100;

        // Volume component (30%) - more markets = more contribution
        let volume_tier = match self.markets_created {
            0..=5 => 2000u32,
            6..=20 => 4000,
            21..=50 => 6000,
            51..=100 => 8000,
            _ => 10000,
        };
        let volume = volume_tier * 30 / 100;

        // Profitability component (20%)
        let profit_tier = if self.total_profit <= 0 {
            2000u32
        } else {
            match self.total_profit as u64 {
                0..=1_000_000_000 => 4000,      // < 1 SOL profit
                1_000_000_001..=10_000_000_000 => 6000,
                10_000_000_001..=100_000_000_000 => 8000,
                _ => 10000,
            }
        };
        let profit = profit_tier * 20 / 100;

        (accuracy + volume + profit).min(10000) as u16
    }
}
