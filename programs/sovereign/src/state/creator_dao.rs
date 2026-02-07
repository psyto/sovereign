use anchor_lang::prelude::*;

// =============================================================================
// CREATOR DAO EXTENSION FOR SOVEREIGN
// =============================================================================
//
// Implementation of Vitalik's "How I would do creator coins" proposal:
// https://vitalik.eth.limo/general/2025/01/23/creatorcoins.html
//
// Key principles from Vitalik:
// 1. "Create a DAO that is NOT token-based. Instead, the inspiration should be
//    Protocol Guild: there are N members, and they can (anonymously) vote new
//    members in and out."
//
// 2. "Do NOT try to make the DAO universal or even industry-wide. Instead,
//    embrace the opinionatedness. Be okay with having a dominant type of
//    content... and be okay with having a dominant style."
//
// 3. "Hand-pick the initial membership set, in order to maximize its alignment
//    with the desired style."
//
// 4. "If N gets above ~200, consider auto-splitting it."
//
// 5. "The token speculators are NOT participating in a recursive-speculation
//    attention game backed only by itself. Instead, they are specifically being
//    predictors of what new creators the high-value creator DAOs will be
//    willing to accept."
// =============================================================================

/// Maximum members before auto-split is recommended
/// Vitalik: "If N gets above ~200, consider auto-splitting it"
pub const MAX_DAO_MEMBERS: usize = 200;

/// Maximum pending nominations at once
pub const MAX_PENDING_NOMINATIONS: usize = 20;

/// Content type classification
/// Vitalik: "Be okay with having a dominant type of content (long-form writing,
/// music, short-form video, long-form video, fiction, educational...)"
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ContentType {
    LongFormWriting,    // Essays, articles, newsletters (like Substack)
    ShortFormWriting,   // Tweets, threads, short posts
    Music,              // Original music, compositions
    ShortFormVideo,     // TikTok, Reels, YouTube Shorts
    LongFormVideo,      // YouTube, documentaries, lectures
    Fiction,            // Novels, short stories, creative writing
    Educational,        // Tutorials, courses, how-tos
    Podcasts,           // Audio content, interviews
    Art,                // Visual art, illustrations, photography
    Code,               // Open source, developer content
}

/// Vote choice for member admission
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VoteChoice {
    Abstain,
    Accept,
    Reject,
}

// =============================================================================
// CREATOR DAO ACCOUNT
// =============================================================================
// Vitalik: "Create a DAO that is NOT token-based. Instead, the inspiration
// should be Protocol Guild: there are N members, and they can (anonymously)
// vote new members in and out."
// =============================================================================

#[account]
pub struct CreatorDAO {
    // === Identity ===
    /// Unique identifier for this DAO
    pub dao_id: u64,
    /// Human-readable name (max 32 bytes)
    pub name: [u8; 32],
    /// Description/mission (max 128 bytes)
    pub description: [u8; 128],

    // === Opinionatedness ===
    // Vitalik: "embrace the opinionatedness... be okay with having a dominant
    // style (eg. country or region of origin, political viewpoint, if within
    // crypto which projects you're most friendly to...)"

    /// Primary content type this DAO focuses on
    pub content_type: ContentType,
    /// Style tag - opinionated niche identifier (e.g., "solana-defi", "ea-rationalist")
    pub style_tag: [u8; 32],
    /// Region/culture affinity (optional, 0 = global)
    pub region_code: u16,

    // === Membership ===
    // Vitalik: "there are N members"

    /// Current number of members
    pub member_count: u16,
    /// Authority who can initialize the DAO (founder)
    pub founder: Pubkey,
    /// Timestamp of creation
    pub created_at: i64,

    // === Governance Parameters ===
    /// Percentage of votes needed to admit (e.g., 60 = 60%)
    pub admission_threshold: u8,
    /// Minimum voting period in seconds (e.g., 7 days = 604800)
    pub voting_period: i64,
    /// Minimum members required to vote for quorum
    pub quorum: u8,

    // === State ===
    /// Number of pending nominations
    pub pending_nominations: u8,
    /// Total creators ever admitted
    pub total_admitted: u64,
    /// Total creators ever removed
    pub total_removed: u64,
    /// Whether the DAO is active
    pub is_active: bool,
    /// Nonce for generating unique nomination IDs
    pub nomination_nonce: u64,

    // === Auto-split tracking ===
    // Vitalik: "If N gets above ~200, consider auto-splitting it"

    /// Parent DAO if this was created from a split
    pub parent_dao: Option<Pubkey>,
    /// Number of child DAOs spawned from splits
    pub split_count: u8,

    /// PDA bump seed
    pub bump: u8,
}

impl CreatorDAO {
    pub const SIZE: usize = 8 +     // discriminator
        8 +                          // dao_id
        32 +                         // name
        128 +                        // description
        1 +                          // content_type
        32 +                         // style_tag
        2 +                          // region_code
        2 +                          // member_count
        32 +                         // founder
        8 +                          // created_at
        1 +                          // admission_threshold
        8 +                          // voting_period
        1 +                          // quorum
        1 +                          // pending_nominations
        8 +                          // total_admitted
        8 +                          // total_removed
        1 +                          // is_active
        8 +                          // nomination_nonce
        33 +                         // parent_dao (Option<Pubkey>)
        1 +                          // split_count
        1;                           // bump

    /// Check if DAO should consider splitting
    pub fn should_consider_split(&self) -> bool {
        self.member_count as usize >= MAX_DAO_MEMBERS
    }
}

// =============================================================================
// DAO MEMBERSHIP ACCOUNT
// =============================================================================
// Tracks individual membership in a DAO
// Vitalik: "Hand-pick the initial membership set"
// =============================================================================

#[account]
pub struct DAOMembership {
    /// The DAO this membership belongs to
    pub dao: Pubkey,
    /// The member's SOVEREIGN identity
    pub member_identity: Pubkey,
    /// The member's wallet
    pub member_wallet: Pubkey,
    /// When they were admitted
    pub admitted_at: i64,
    /// Who nominated them (null for founders)
    pub nominated_by: Option<Pubkey>,
    /// Number of successful nominations they've made
    pub successful_nominations: u16,
    /// Number of votes cast
    pub votes_cast: u64,
    /// Whether membership is active
    pub is_active: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl DAOMembership {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 33 + 2 + 8 + 1 + 1;
}

// =============================================================================
// NOMINATION ACCOUNT
// =============================================================================
// Vitalik: "they can (anonymously) vote new members in and out"
// =============================================================================

#[account]
pub struct Nomination {
    /// The DAO this nomination is for
    pub dao: Pubkey,
    /// Unique nomination ID within the DAO
    pub nomination_id: u64,
    /// The creator being nominated (their SOVEREIGN identity)
    pub nominee_identity: Pubkey,
    /// The nominee's wallet
    pub nominee_wallet: Pubkey,
    /// Who made the nomination (must be existing member)
    pub nominator: Pubkey,
    /// Reason/justification for nomination (max 256 bytes)
    pub reason: [u8; 256],

    // === Voting State ===
    /// When nomination was created
    pub created_at: i64,
    /// When voting ends
    pub voting_ends_at: i64,
    /// Number of accept votes
    pub votes_accept: u16,
    /// Number of reject votes
    pub votes_reject: u16,
    /// Number of abstentions
    pub votes_abstain: u16,
    /// Total members at time of nomination (for quorum calculation)
    pub total_members_snapshot: u16,

    // === Resolution ===
    /// Whether voting has been resolved
    pub is_resolved: bool,
    /// Whether nominee was accepted (only valid if resolved)
    pub was_accepted: bool,
    /// When resolved
    pub resolved_at: Option<i64>,

    /// PDA bump seed
    pub bump: u8,
}

impl Nomination {
    pub const SIZE: usize = 8 +     // discriminator
        32 +                         // dao
        8 +                          // nomination_id
        32 +                         // nominee_identity
        32 +                         // nominee_wallet
        32 +                         // nominator
        256 +                        // reason
        8 +                          // created_at
        8 +                          // voting_ends_at
        2 +                          // votes_accept
        2 +                          // votes_reject
        2 +                          // votes_abstain
        2 +                          // total_members_snapshot
        1 +                          // is_resolved
        1 +                          // was_accepted
        9 +                          // resolved_at (Option<i64>)
        1;                           // bump

    /// Check if quorum is reached
    pub fn has_quorum(&self, quorum_threshold: u8) -> bool {
        let total_votes = self.votes_accept + self.votes_reject + self.votes_abstain;
        let required = (self.total_members_snapshot as u32 * quorum_threshold as u32) / 100;
        total_votes as u32 >= required
    }

    /// Check if admission threshold is met
    pub fn meets_threshold(&self, threshold: u8) -> bool {
        let total_decisive = self.votes_accept + self.votes_reject;
        if total_decisive == 0 {
            return false;
        }
        let accept_pct = (self.votes_accept as u32 * 100) / total_decisive as u32;
        accept_pct >= threshold as u32
    }
}

// =============================================================================
// VOTE RECORD (for anonymity tracking without revealing vote)
// =============================================================================
// Vitalik: "(anonymously) vote"
// Note: For true anonymity, integrate with VEIL's ZK infrastructure
// This is a simplified version that hides vote choice but not participation
// =============================================================================

#[account]
pub struct VoteRecord {
    /// The nomination this vote is for
    pub nomination: Pubkey,
    /// Hash of (voter_identity + nomination_id + salt) - hides who voted how
    pub voter_hash: [u8; 32],
    /// The actual vote (encrypted or committed for ZK version)
    pub vote: VoteChoice,
    /// When vote was cast
    pub voted_at: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl VoteRecord {
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

// =============================================================================
// CREATOR SCORE DETAILS
// =============================================================================
// Extension to SOVEREIGN's identity for creator reputation
// Vitalik: "the ultimate decider of who rises and falls is not speculators,
// but high-value content creators (we make the assumption that good creators
// are also good judges of quality, which seems often true)"
// =============================================================================

#[account]
pub struct CreatorScoreDetails {
    /// Reference to the SOVEREIGN identity
    pub identity: Pubkey,

    // === DAO Acceptance Metrics ===
    // Vitalik: Value comes from being accepted by high-quality DAOs

    /// Number of DAOs that have accepted this creator
    pub daos_accepted: u16,
    /// Weighted reputation from DAO acceptances (higher-tier DAOs = more weight)
    pub dao_reputation_points: u32,

    // === Judgment Quality Metrics ===
    // Vitalik: "good creators are also good judges of quality"

    /// How many times their nominations were accepted
    pub successful_nominations: u16,
    /// How many times their nominations were rejected
    pub failed_nominations: u16,
    /// Nomination accuracy (successful / total) in basis points
    pub nomination_accuracy_bps: u16,

    // === Prediction Market Performance ===
    // Vitalik: "speculators... are specifically being predictors of what new
    // creators the high-value creator DAOs will be willing to accept"

    /// Profit/loss from prediction market (in basis points of initial stake)
    pub prediction_pnl_bps: i32,
    /// Number of correct predictions
    pub predictions_correct: u32,
    /// Number of incorrect predictions
    pub predictions_incorrect: u32,
    /// Prediction accuracy in basis points
    pub prediction_accuracy_bps: u16,

    // === Content Quality Signals ===
    /// Peer upvotes received (from other DAO members)
    pub peer_upvotes: u64,
    /// Content pieces created
    pub content_count: u32,

    // === Burn Metrics ===
    // Vitalik: "a portion of their proceeds from the DAO are used to burn
    // their creator coins"

    /// Total amount burned from DAO proceeds (in lamports)
    pub total_burned: u64,

    // === Timestamps ===
    pub first_dao_acceptance: Option<i64>,
    pub last_updated: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl CreatorScoreDetails {
    pub const SIZE: usize = 8 +     // discriminator
        32 +                         // identity
        2 +                          // daos_accepted
        4 +                          // dao_reputation_points
        2 +                          // successful_nominations
        2 +                          // failed_nominations
        2 +                          // nomination_accuracy_bps
        4 +                          // prediction_pnl_bps
        4 +                          // predictions_correct
        4 +                          // predictions_incorrect
        2 +                          // prediction_accuracy_bps
        8 +                          // peer_upvotes
        4 +                          // content_count
        8 +                          // total_burned
        9 +                          // first_dao_acceptance
        8 +                          // last_updated
        1;                           // bump

    /// Calculate creator score (0-10000 basis points)
    ///
    /// Weighting rationale (aligned with Vitalik's hierarchy):
    /// - DAO acceptance (40%): Primary signal - accepted by quality peers
    /// - Judgment quality (25%): Good creators judge well
    /// - Prediction accuracy (20%): Market participants who predict well
    /// - Peer upvotes (15%): Content quality signal
    pub fn calculate_score(&self) -> u16 {
        // DAO acceptance component (40%)
        // More DAOs + higher tier DAOs = higher score
        let dao_component = self.dao_acceptance_score() as u32 * 40 / 100;

        // Judgment quality component (25%)
        // Good nominators = good judges of quality
        let judgment_component = self.nomination_accuracy_bps as u32 * 25 / 100;

        // Prediction accuracy component (20%)
        // Accurate predictors contribute to surfacing
        let prediction_component = self.prediction_accuracy_bps as u32 * 20 / 100;

        // Peer upvotes component (15%)
        let upvote_component = self.upvote_tier() as u32 * 15 / 100;

        (dao_component + judgment_component + prediction_component + upvote_component)
            .min(10000) as u16
    }

    fn dao_acceptance_score(&self) -> u16 {
        // Logarithmic scaling: 1 DAO = 4000, 3 DAOs = 6000, 10 DAOs = 8000, 30+ = 10000
        match self.daos_accepted {
            0 => 0,
            1 => 4000,
            2 => 5000,
            3..=5 => 6000,
            6..=10 => 7000,
            11..=20 => 8000,
            21..=30 => 9000,
            _ => 10000,
        }
    }

    fn upvote_tier(&self) -> u16 {
        match self.peer_upvotes {
            0..=10 => 2000,
            11..=50 => 4000,
            51..=200 => 6000,
            201..=1000 => 8000,
            _ => 10000,
        }
    }
}
