use anchor_lang::prelude::*;

// =============================================================================
// SOVEREIGN STATE - Multi-Dimensional Reputation Protocol
// =============================================================================
//
// Extended with Vitalik's Creator Coin model.
// See: https://vitalik.eth.limo/general/2025/01/23/creatorcoins.html
// =============================================================================

// Vitalik's Creator Coin Extension - new state modules
pub mod creator_dao;
pub mod admission_market;

pub use creator_dao::*;
pub use admission_market::*;

// =============================================================================
// SOVEREIGN IDENTITY - Multi-Dimensional Reputation Protocol
// =============================================================================
//
// Extended with Creator dimension based on Vitalik's "How I would do creator
// coins" proposal. The Creator dimension is unique in that its "authority"
// is not a single oracle, but the collective judgment of Creator DAOs.
//
// Vitalik: "the ultimate decider of who rises and falls is not speculators,
// but high-value content creators (we make the assumption that good creators
// are also good judges of quality, which seems often true)"
// =============================================================================

/// Main identity account that stores user's multi-dimensional reputation
#[account]
pub struct SovereignIdentity {
    // === Identity ===
    /// The wallet that owns this identity
    pub owner: Pubkey,
    /// When this identity was created
    pub created_at: i64,

    // === Authorities (who can write each dimension) ===
    /// Authority that can update trading score (e.g., Dverse oracle)
    pub trading_authority: Pubkey,
    /// Authority that can update civic score (e.g., Komon program)
    pub civic_authority: Pubkey,
    /// Authority that can update developer score (e.g., Earn-Agent oracle)
    pub developer_authority: Pubkey,
    /// Authority that can update infrastructure score (e.g., DePINfinity program)
    pub infra_authority: Pubkey,
    /// Authority that can update creator score (CreatorDAO program)
    /// Vitalik: Unlike other dimensions, this is governed by peer collectives
    pub creator_authority: Pubkey,

    // === Dimension Scores (0-10000 basis points) ===
    /// Trading reputation score
    pub trading_score: u16,
    /// Civic participation score
    pub civic_score: u16,
    /// Developer reputation score
    pub developer_score: u16,
    /// Infrastructure contribution score
    pub infra_score: u16,
    /// Creator reputation score (Vitalik's creator coin model)
    /// Derived from: DAO acceptances, judgment quality, prediction accuracy
    pub creator_score: u16,

    // === Computed ===
    /// Weighted composite score
    pub composite_score: u16,
    /// Tier level (1-5)
    pub tier: u8,

    // === Metadata ===
    /// Last time any score was updated
    pub last_updated: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl SovereignIdentity {
    pub const SIZE: usize = 8 +  // discriminator
        32 +                     // owner
        8 +                      // created_at
        32 +                     // trading_authority
        32 +                     // civic_authority
        32 +                     // developer_authority
        32 +                     // infra_authority
        32 +                     // creator_authority (NEW - Vitalik extension)
        2 +                      // trading_score
        2 +                      // civic_score
        2 +                      // developer_score
        2 +                      // infra_score
        2 +                      // creator_score (NEW - Vitalik extension)
        2 +                      // composite_score
        1 +                      // tier
        8 +                      // last_updated
        1;                       // bump
    // Total: 236 bytes

    /// Recalculate composite score and tier based on dimension scores
    ///
    /// Updated weighting to include Creator dimension:
    /// - Trading: 30% (reduced from 40%)
    /// - Civic: 20% (reduced from 25%)
    /// - Developer: 15% (reduced from 20%)
    /// - Infra: 10% (reduced from 15%)
    /// - Creator: 25% (NEW - Vitalik's creator coin model)
    ///
    /// Vitalik: "the ultimate decider of who rises and falls is not speculators,
    /// but high-value content creators"
    pub fn recalculate(&mut self) {
        // Weighted average with Creator dimension
        let weighted = self.trading_score as u32 * 30
            + self.civic_score as u32 * 20
            + self.developer_score as u32 * 15
            + self.infra_score as u32 * 10
            + self.creator_score as u32 * 25;  // Creator has significant weight

        self.composite_score = (weighted / 100) as u16;

        // Calculate tier from composite score
        self.tier = match self.composite_score {
            0..=1999 => 1,      // Bronze
            2000..=3999 => 2,   // Silver
            4000..=5999 => 3,   // Gold
            6000..=7999 => 4,   // Platinum
            _ => 5,             // Diamond
        };
    }

    /// Recalculate using legacy weights (without Creator dimension)
    /// For backwards compatibility during migration
    pub fn recalculate_legacy(&mut self) {
        let weighted = self.trading_score as u32 * 40
            + self.civic_score as u32 * 25
            + self.developer_score as u32 * 20
            + self.infra_score as u32 * 15;

        self.composite_score = (weighted / 100) as u16;

        self.tier = match self.composite_score {
            0..=1999 => 1,
            2000..=3999 => 2,
            4000..=5999 => 3,
            6000..=7999 => 4,
            _ => 5,
        };
    }
}

/// Optional: Detailed trading score breakdown
#[account]
pub struct TradingScoreDetails {
    /// Reference to the identity
    pub identity: Pubkey,
    /// Win rate in basis points (0-10000)
    pub win_rate_bps: u16,
    /// Profit factor in basis points (0-50000 = 0-5.0x)
    pub profit_factor_bps: u16,
    /// Total number of trades
    pub total_trades: u64,
    /// Total trading volume in USDC (6 decimals)
    pub total_volume: u64,
    /// Maximum drawdown in basis points
    pub max_drawdown_bps: u16,
    /// Last update timestamp
    pub last_updated: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl TradingScoreDetails {
    pub const SIZE: usize = 8 + 32 + 2 + 2 + 8 + 8 + 2 + 8 + 1;

    /// Calculate trading score from detailed metrics
    pub fn calculate_score(&self) -> u16 {
        // Weighted formula:
        // Win rate: 30%, Profit factor: 25%, Volume: 20%, Drawdown: 15%, Consistency: 10%
        let win_rate_component = self.win_rate_bps as u32 * 30 / 100;
        let pf_component = (self.profit_factor_bps.min(20000) / 2) as u32 * 25 / 100;
        let volume_component = Self::volume_tier(self.total_volume) as u32 * 20 / 100;
        let drawdown_component = (10000 - self.max_drawdown_bps) as u32 * 15 / 100;
        let consistency_component = Self::consistency_tier(self.total_trades) as u32 * 10 / 100;

        (win_rate_component + pf_component + volume_component + drawdown_component + consistency_component)
            .min(10000) as u16
    }

    fn volume_tier(volume: u64) -> u16 {
        match volume {
            0..=1_000_000_000 => 2000,                  // < 1K USDC
            1_000_000_001..=10_000_000_000 => 4000,     // 1K-10K
            10_000_000_001..=100_000_000_000 => 6000,   // 10K-100K
            100_000_000_001..=1_000_000_000_000 => 8000, // 100K-1M
            _ => 10000,                                 // > 1M
        }
    }

    fn consistency_tier(trades: u64) -> u16 {
        match trades {
            0..=10 => 2000,
            11..=50 => 4000,
            51..=200 => 6000,
            201..=1000 => 8000,
            _ => 10000,
        }
    }
}

/// Optional: Detailed civic score breakdown
#[account]
pub struct CivicScoreDetails {
    /// Reference to the identity
    pub identity: Pubkey,
    /// Number of problems solved
    pub problems_solved: u64,
    /// Prediction accuracy in basis points (0-10000)
    pub prediction_accuracy_bps: u16,
    /// Number of directions proposed
    pub directions_proposed: u64,
    /// Number of directions that won
    pub directions_won: u64,
    /// Current winning streak
    pub current_streak: u16,
    /// Community trust score (0-10000)
    pub community_trust: u16,
    /// Last update timestamp
    pub last_updated: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl CivicScoreDetails {
    pub const SIZE: usize = 8 + 32 + 8 + 2 + 8 + 8 + 2 + 2 + 8 + 1;

    /// Calculate civic score from detailed metrics
    pub fn calculate_score(&self) -> u16 {
        // Weighted formula:
        // Accuracy: 40%, Problems solved: 25%, Trust: 25%, Streak: 10%
        let accuracy_component = self.prediction_accuracy_bps as u32 * 40 / 100;
        let solved_component = Self::solved_tier(self.problems_solved) as u32 * 25 / 100;
        let trust_component = self.community_trust as u32 * 25 / 100;
        let streak_component = Self::streak_tier(self.current_streak) as u32 * 10 / 100;

        (accuracy_component + solved_component + trust_component + streak_component)
            .min(10000) as u16
    }

    fn solved_tier(solved: u64) -> u16 {
        match solved {
            0..=2 => 2000,
            3..=10 => 4000,
            11..=50 => 6000,
            51..=200 => 8000,
            _ => 10000,
        }
    }

    fn streak_tier(streak: u16) -> u16 {
        match streak {
            0..=2 => 2000,
            3..=5 => 4000,
            6..=10 => 6000,
            11..=20 => 8000,
            _ => 10000,
        }
    }
}
