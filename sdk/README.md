# @sovereign/sdk

TypeScript SDK for the SOVEREIGN identity and reputation protocol on Solana.

Five-dimension reputation system with Creator DAOs and admission prediction markets.

## Installation

```bash
npm install @sovereign/sdk
# or
yarn add @sovereign/sdk
```

## Quick Start

```typescript
import { SovereignClient } from "@sovereign/sdk";
import { AnchorProvider } from "@coral-xyz/anchor";

const provider = AnchorProvider.env();
const client = new SovereignClient(provider, idl);
```

## Features

### Identity & Scores

```typescript
// Create identity
await client.createIdentity();

// Get all scores for a user
const scores = await client.getScores(owner);
console.log(`Trading: ${scores.trading}`);
console.log(`Civic: ${scores.civic}`);
console.log(`Developer: ${scores.developer}`);
console.log(`Infra: ${scores.infra}`);
console.log(`Creator: ${scores.creator}`);
console.log(`Composite: ${scores.composite} (Tier ${scores.tier})`);

// Get tier info
import { getTierName, getPointsToNextTier } from "@sovereign/sdk";
console.log(getTierName(scores.tier));  // "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond"
console.log(`Points to next tier: ${getPointsToNextTier(scores.composite, scores.tier)}`);
```

### Authority Management

Each score dimension has its own authority (oracle/program):

```typescript
await client.setTradingAuthority(oracleKey);
await client.setCivicAuthority(oracleKey);
await client.setDeveloperAuthority(oracleKey);
await client.setInfraAuthority(oracleKey);
await client.setCreatorAuthority(oracleKey);
```

### Score Updates (Authority Only)

```typescript
await client.updateTradingScore(identityOwner, 7500, authorityKeypair);
await client.updateCreatorScore(identityOwner, 6000, authorityKeypair);
```

### Creator DAOs

Peer-judgment DAOs based on Vitalik's creator coin model:

```typescript
import { ContentType, VoteChoice } from "@sovereign/sdk";

// Create a DAO
await client.createDao({
  name: "Solana Music Collective",
  description: "DAO for electronic music producers",
  contentType: ContentType.Music,
  styleTag: "electronic",
  regionCode: "global",
  admissionThreshold: 66,  // 66% approval needed
  votingPeriod: new BN(7 * 86400),  // 7 days
  quorum: 50,  // 50% must vote
});

// Add founder members
await client.addFounderMember(daoPda, memberWallet);

// Nominate a creator
await client.nominateCreator(daoPda, nomineeWallet, {
  reason: "Outstanding producer with 10+ releases",
});

// Cast vote (with random salt for semi-anonymous voting)
const salt = crypto.getRandomValues(new Uint8Array(32));
await client.castVote(daoPda, nominationPda, VoteChoice.Accept, salt);

// Resolve nomination after voting period
await client.resolveNomination(daoPda, nominationPda, nomineeWallet);
```

### Admission Markets

CPMM prediction markets on creator admission outcomes:

```typescript
import { PositionSide } from "@sovereign/sdk";

// Create a prediction market on a creator's admission
await client.createMarket(daoPda, predictedCreatorWallet, {
  initialLiquidity: new BN(1000),
  expiryDays: 30,
});

// Take a position (predict YES - creator will be admitted)
await client.takePosition(marketPda, {
  amount: new BN(100),
  side: PositionSide.Yes,
  minTokens: new BN(90),
});

// Claim winnings after market resolves
await client.claimWinnings(marketPda, burnTreasury);
```

### Score Calculation Utilities

Mirror the on-chain Rust logic in TypeScript:

```typescript
import {
  calculateCompositeScore,
  calculateCreatorScore,
  calculateScoutScore,
  SCORE_WEIGHTS,
} from "@sovereign/sdk";

// Composite score (weights: trading 30%, civic 20%, developer 15%, infra 10%, creator 25%)
const composite = calculateCompositeScore({
  trading: 8000, civic: 6000, developer: 7000, infra: 5000, creator: 9000,
});

// Creator score (40% DAO acceptance, 25% judgment, 20% prediction accuracy, 15% peer upvotes)
const creatorScore = calculateCreatorScore({
  daoReputationPoints: 500,
  predictionAccuracyBps: 7500,
  peerUpvotes: 100,
  peerDownvotes: 10,
  predictionsCorrect: 15,
  predictionsIncorrect: 5,
});
```

## PDA Utilities

```typescript
import {
  SOVEREIGN_PROGRAM_ID,
  getIdentityPda,
  getTradingDetailsPda,
  getCivicDetailsPda,
  getCreatorDetailsPda,
  getDaoPda,
  getDaoMembershipPda,
  getNominationPda,
  getVoteRecordPda,
  getAdmissionMarketPda,
  getMarketPositionPda,
  getMarketFactoryPda,
  getSurfacingScorePda,
} from "@sovereign/sdk";

const [identity, bump] = getIdentityPda(ownerWallet);
const [dao] = getDaoPda(founderWallet, daoId);
const [market] = getAdmissionMarketPda(daoPda, creatorIdentityPda);
```

## Types

```typescript
import type {
  SovereignIdentity,
  Scores,
  TradingScoreDetails,
  CivicScoreDetails,
  CreatorScoreDetails,
  CreatorDAO,
  DAOMembership,
  Nomination,
  VoteRecord,
  AdmissionMarket,
  MarketPosition,
  MarketFactory,
  SurfacingScore,
} from "@sovereign/sdk";
```

## License

MIT
