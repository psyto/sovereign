// Main client
export { SovereignClient } from './client';

// PDA utilities
export {
  SOVEREIGN_PROGRAM_ID,
  getIdentityPda,
  getTradingDetailsPda,
  getCivicDetailsPda,
  getCreatorDetailsPda,
  getDaoCounterPda,
  getDaoPda,
  getDaoMembershipPda,
  getNominationPda,
  getVoteRecordPda,
  getAdmissionMarketPda,
  getMarketPositionPda,
  getMarketFactoryPda,
  getSurfacingScorePda,
} from './pda';

// Account types
export type {
  SovereignIdentity,
  Scores,
  TradingScoreDetails,
  CivicScoreDetails,
  CreatorScoreDetails,
  DAOCounter,
  CreatorDAO,
  DAOMembership,
  Nomination,
  VoteRecord,
  AdmissionMarket,
  MarketPosition,
  MarketFactory,
  SurfacingScore,
  TierConfig,
} from './types';

// Param types
export type {
  CreateDAOParams,
  NominateCreatorParams,
  CreateAdmissionMarketParams,
  TakePositionParams,
} from './types';

// Enums
export {
  ContentType,
  VoteChoice,
  MarketStatus,
  MarketOutcome,
  PositionSide,
} from './types';

// Score utilities
export {
  SCORE_WEIGHTS,
  calculateCompositeScore,
  calculateCreatorScore,
  calculateScoutScore,
  TIER_CONFIGS,
  getTierName,
  getPointsToNextTier,
} from './types';
