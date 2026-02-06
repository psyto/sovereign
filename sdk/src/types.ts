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

  /** Trading reputation score (0-10000) */
  tradingScore: number;
  /** Civic participation score (0-10000) */
  civicScore: number;
  /** Developer reputation score (0-10000) */
  developerScore: number;
  /** Infrastructure contribution score (0-10000) */
  infraScore: number;

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
