import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * SOVEREIGN Identity account data
 */
export interface SovereignIdentity {
  /** The wallet that owns this identity */
  owner: PublicKey;
  /** When this identity was created */
  createdAt: BN;

  /** Authority that can update trading score */
  tradingAuthority: PublicKey;
  /** Authority that can update civic score */
  civicAuthority: PublicKey;
  /** Authority that can update developer score */
  developerAuthority: PublicKey;
  /** Authority that can update infrastructure score */
  infraAuthority: PublicKey;
  /** Authority that can update creator score */
  creatorAuthority: PublicKey;

  /** Trading reputation score (0-10000) */
  tradingScore: number;
  /** Civic participation score (0-10000) */
  civicScore: number;
  /** Developer reputation score (0-10000) */
  developerScore: number;
  /** Infrastructure contribution score (0-10000) */
  infraScore: number;
  /** Creator reputation score (0-10000) */
  creatorScore: number;

  /** Weighted composite score (0-10000) */
  compositeScore: number;
  /** Tier level (1-5) */
  tier: number;

  /** Last time any score was updated */
  lastUpdated: BN;
  /** PDA bump seed */
  bump: number;
}

/**
 * Simplified scores view
 */
export interface Scores {
  trading: number;
  civic: number;
  developer: number;
  infra: number;
  creator: number;
  composite: number;
  tier: number;
}

/**
 * Detailed trading score breakdown
 */
export interface TradingScoreDetails {
  identity: PublicKey;
  winRateBps: number;
  profitFactorBps: number;
  totalTrades: BN;
  totalVolume: BN;
  maxDrawdownBps: number;
  lastUpdated: BN;
  bump: number;
}

/**
 * Detailed civic score breakdown
 */
export interface CivicScoreDetails {
  identity: PublicKey;
  problemsSolved: BN;
  predictionAccuracyBps: number;
  directionsProposed: BN;
  directionsWon: BN;
  currentStreak: number;
  communityTrust: number;
  lastUpdated: BN;
  bump: number;
}

// ============================================================================
// Creator DAO Types
// ============================================================================

export enum ContentType {
  Music = 0,
  VisualArt = 1,
  Writing = 2,
  Video = 3,
  Photography = 4,
  Design = 5,
  Gaming = 6,
  Education = 7,
  Technology = 8,
  Other = 9,
}

export enum VoteChoice {
  Accept = 0,
  Reject = 1,
  Abstain = 2,
}

export enum MarketStatus {
  Open = 0,
  Resolved = 1,
  Cancelled = 2,
  Expired = 3,
}

export enum MarketOutcome {
  Pending = 0,
  Accepted = 1,
  Rejected = 2,
  Cancelled = 3,
}

export enum PositionSide {
  Yes = 0,
  No = 1,
}

/**
 * Detailed creator score breakdown
 */
export interface CreatorScoreDetails {
  identity: PublicKey;
  daosAccepted: number;
  firstDaoAcceptance: BN | null;
  daoReputationPoints: number;
  failedNominations: number;
  predictionsCorrect: number;
  predictionsIncorrect: number;
  predictionAccuracyBps: number;
  predictionPnlBps: number;
  peerUpvotes: BN;
  peerDownvotes: BN;
  totalBurned: BN;
  lastUpdated: BN;
  bump: number;
}

/**
 * DAO counter for unique DAO IDs
 */
export interface DAOCounter {
  count: BN;
  bump: number;
}

/**
 * Creator DAO account
 */
export interface CreatorDAO {
  daoId: BN;
  name: number[]; // Fixed 64-byte array
  description: number[]; // Fixed 256-byte array
  contentType: ContentType;
  styleTag: number[]; // Fixed 32-byte array
  regionCode: number[]; // Fixed 8-byte array
  admissionThreshold: number;
  votingPeriod: BN;
  quorum: number;
  memberCount: number;
  founder: PublicKey;
  createdAt: BN;
  pendingNominations: number;
  totalAdmitted: BN;
  totalRemoved: BN;
  isActive: boolean;
  nominationNonce: BN;
  bump: number;
}

/**
 * DAO membership account
 */
export interface DAOMembership {
  dao: PublicKey;
  memberIdentity: PublicKey;
  memberWallet: PublicKey;
  admittedAt: BN;
  nominatedBy: PublicKey | null;
  successfulNominations: number;
  votesCast: number;
  isActive: boolean;
  bump: number;
}

/**
 * Nomination account
 */
export interface Nomination {
  dao: PublicKey;
  nominationId: BN;
  nomineeIdentity: PublicKey;
  nomineeWallet: PublicKey;
  nominator: PublicKey;
  reason: number[]; // Fixed 256-byte array
  createdAt: BN;
  votingEndsAt: BN;
  votesAccept: number;
  votesReject: number;
  votesAbstain: number;
  totalMembersSnapshot: number;
  isResolved: boolean;
  wasAccepted: boolean;
  resolvedAt: BN | null;
  bump: number;
}

/**
 * Vote record account (semi-anonymous via hash)
 */
export interface VoteRecord {
  nomination: PublicKey;
  voterHash: number[]; // 32-byte keccak hash
  vote: VoteChoice;
  votedAt: BN;
  bump: number;
}

// ============================================================================
// Admission Market Types
// ============================================================================

/**
 * Admission market (CPMM prediction market with burn)
 */
export interface AdmissionMarket {
  marketId: BN;
  dao: PublicKey;
  creatorIdentity: PublicKey;
  creatorWallet: PublicKey;
  marketCreator: PublicKey;
  creatorBonusBps: number;
  yesPool: BN;
  noPool: BN;
  totalPool: BN;
  predictorCount: number;
  feeBps: number;
  accumulatedFees: BN;
  createdAt: BN;
  tradingEndsAt: BN | null;
  expiresAt: BN;
  status: MarketStatus;
  outcome: MarketOutcome;
  resolvedByNomination: PublicKey | null;
  resolvedAt: BN | null;
  burnPercentageBps: number;
  amountBurned: BN;
  bump: number;
}

/**
 * Market position account
 */
export interface MarketPosition {
  market: PublicKey;
  predictor: PublicKey;
  predictorIdentity: PublicKey | null;
  yesTokens: BN;
  noTokens: BN;
  totalStaked: BN;
  openedAt: BN;
  claimed: boolean;
  payout: BN;
  bump: number;
}

/**
 * Market factory configuration
 */
export interface MarketFactory {
  marketCount: BN;
  totalMarkets: BN;
  totalVolume: BN;
  minInitialLiquidity: BN;
  bump: number;
}

/**
 * Surfacing score for talent scouts
 */
export interface SurfacingScore {
  identity: PublicKey;
  marketsCreated: number;
  successfulSurfaces: number;
  surfacingAccuracyBps: number;
  scoutScore: number;
  lastUpdated: BN;
  bump: number;
}

// ============================================================================
// Instruction Params
// ============================================================================

export interface CreateDAOParams {
  name: string;
  description: string;
  contentType: ContentType;
  styleTag: string;
  regionCode: string;
  admissionThreshold: number;
  votingPeriod: BN;
  quorum: number;
}

export interface NominateCreatorParams {
  reason: string;
}

export interface CreateAdmissionMarketParams {
  initialLiquidity: BN;
  expiryDays: number;
}

export interface TakePositionParams {
  amount: BN;
  side: PositionSide;
  minTokens: BN;
}

// ============================================================================
// Score Weights (matching Rust constants)
// ============================================================================

export const SCORE_WEIGHTS = {
  trading: 30,
  civic: 20,
  developer: 15,
  infra: 10,
  creator: 25,
} as const;

/**
 * Calculate composite score from individual dimensions (mirrors Rust logic)
 */
export function calculateCompositeScore(scores: {
  trading: number;
  civic: number;
  developer: number;
  infra: number;
  creator: number;
}): number {
  return Math.floor(
    (scores.trading * SCORE_WEIGHTS.trading +
      scores.civic * SCORE_WEIGHTS.civic +
      scores.developer * SCORE_WEIGHTS.developer +
      scores.infra * SCORE_WEIGHTS.infra +
      scores.creator * SCORE_WEIGHTS.creator) /
      100
  );
}

/**
 * Calculate creator score from details (mirrors Rust CreatorScoreDetails::calculate_score)
 * Weights: 40% DAO acceptance, 25% judgment quality, 20% prediction accuracy, 15% peer upvotes
 */
export function calculateCreatorScore(details: {
  daoReputationPoints: number;
  predictionAccuracyBps: number;
  peerUpvotes: number;
  peerDownvotes: number;
  predictionsCorrect: number;
  predictionsIncorrect: number;
}): number {
  const daoComponent = Math.min(details.daoReputationPoints, 10000) * 40;

  const totalPredictions = details.predictionsCorrect + details.predictionsIncorrect;
  const judgmentComponent =
    totalPredictions > 0
      ? Math.floor((details.predictionsCorrect * 10000) / totalPredictions) * 25
      : 0;

  const accuracyComponent = details.predictionAccuracyBps * 20;

  const totalVotes = details.peerUpvotes + details.peerDownvotes;
  const peerComponent =
    totalVotes > 0
      ? Math.floor((details.peerUpvotes * 10000) / Number(totalVotes)) * 15
      : 5000 * 15; // neutral default

  return Math.floor((daoComponent + judgmentComponent + accuracyComponent + peerComponent) / 100);
}

/**
 * Calculate surfacing/scout score (mirrors Rust SurfacingScore::calculate_scout_score)
 */
export function calculateScoutScore(details: {
  marketsCreated: number;
  successfulSurfaces: number;
}): number {
  if (details.marketsCreated === 0) return 0;
  return Math.floor((details.successfulSurfaces * 10000) / details.marketsCreated);
}

// ============================================================================
// Tier Configuration
// ============================================================================

/**
 * Tier configuration
 */
export interface TierConfig {
  tier: number;
  minCompositeScore: number;
  name: string;
}

/**
 * Default tier configurations
 */
export const TIER_CONFIGS: TierConfig[] = [
  { tier: 1, minCompositeScore: 0, name: 'Bronze' },
  { tier: 2, minCompositeScore: 2000, name: 'Silver' },
  { tier: 3, minCompositeScore: 4000, name: 'Gold' },
  { tier: 4, minCompositeScore: 6000, name: 'Platinum' },
  { tier: 5, minCompositeScore: 8000, name: 'Diamond' },
];

/**
 * Get tier name from tier number
 */
export function getTierName(tier: number): string {
  return TIER_CONFIGS.find((c) => c.tier === tier)?.name ?? 'Unknown';
}

/**
 * Get points needed to reach next tier
 */
export function getPointsToNextTier(compositeScore: number, currentTier: number): number {
  if (currentTier >= 5) return 0;
  const nextTierConfig = TIER_CONFIGS.find((c) => c.tier === currentTier + 1);
  if (!nextTierConfig) return 0;
  return Math.max(0, nextTierConfig.minCompositeScore - compositeScore);
}
