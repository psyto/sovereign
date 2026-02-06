# SOVEREIGN SDK Reference

TypeScript SDK for interacting with the SOVEREIGN identity and reputation protocol.

## Installation

```bash
npm install @sovereign/sdk
```

## Quick Start

```typescript
import { SovereignClient, getIdentityPda, SOVEREIGN_PROGRAM_ID } from '@sovereign/sdk';
import { AnchorProvider } from '@coral-xyz/anchor';

// Initialize client
const provider = AnchorProvider.env();
const client = new SovereignClient(provider, idl);

// Create identity
await client.createIdentity();

// Read identity
const identity = await client.getIdentity(wallet.publicKey);
console.log(`Tier: ${identity.tier}, Composite: ${identity.compositeScore}`);
```

## API Reference

### SovereignClient

Main client class for interacting with the SOVEREIGN program.

#### Constructor

```typescript
constructor(provider: AnchorProvider, idl?: Idl)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| provider | AnchorProvider | Anchor provider with wallet and connection |
| idl | Idl (optional) | Program IDL (required for write operations) |

---

### Read Operations

#### getIdentity

Get a user's SOVEREIGN identity.

```typescript
async getIdentity(owner: PublicKey): Promise<SovereignIdentity | null>
```

**Returns**: Identity account data or `null` if not found.

**Example**:
```typescript
const identity = await client.getIdentity(userPubkey);
if (identity) {
    console.log(`Owner: ${identity.owner}`);
    console.log(`Tier: ${identity.tier}`);
    console.log(`Trading Score: ${identity.tradingScore}`);
}
```

---

#### getTier

Get a user's tier level.

```typescript
async getTier(owner: PublicKey): Promise<number>
```

**Returns**: Tier number (1-5), defaults to 1 if no identity.

**Example**:
```typescript
const tier = await client.getTier(userPubkey);
if (tier >= 3) {
    // Grant premium access
}
```

---

#### getCompositeScore

Get a user's composite score.

```typescript
async getCompositeScore(owner: PublicKey): Promise<number>
```

**Returns**: Composite score (0-10000), defaults to 0 if no identity.

---

#### getScores

Get all scores for a user.

```typescript
async getScores(owner: PublicKey): Promise<Scores | null>
```

**Returns**: All scores or `null` if no identity.

```typescript
interface Scores {
    trading: number;
    civic: number;
    developer: number;
    infra: number;
    composite: number;
    tier: number;
}
```

**Example**:
```typescript
const scores = await client.getScores(userPubkey);
if (scores) {
    console.log(`Trading: ${scores.trading}`);
    console.log(`Civic: ${scores.civic}`);
    console.log(`Developer: ${scores.developer}`);
    console.log(`Infra: ${scores.infra}`);
    console.log(`Composite: ${scores.composite}`);
    console.log(`Tier: ${scores.tier}`);
}
```

---

#### getTradingDetails

Get detailed trading score breakdown.

```typescript
async getTradingDetails(owner: PublicKey): Promise<TradingScoreDetails | null>
```

**Returns**: Detailed trading metrics or `null` if not found.

---

#### getCivicDetails

Get detailed civic score breakdown.

```typescript
async getCivicDetails(owner: PublicKey): Promise<CivicScoreDetails | null>
```

**Returns**: Detailed civic metrics or `null` if not found.

---

#### hasIdentity

Check if a user has a SOVEREIGN identity.

```typescript
async hasIdentity(owner: PublicKey): Promise<boolean>
```

**Example**:
```typescript
if (await client.hasIdentity(userPubkey)) {
    // User has SOVEREIGN identity
} else {
    // Prompt user to create identity
}
```

---

### Write Operations

#### createIdentity

Create a new SOVEREIGN identity for the connected wallet.

```typescript
async createIdentity(): Promise<string>
```

**Returns**: Transaction signature.

**Note**: Each wallet can only have one identity (PDA-based).

---

#### setTradingAuthority

Set the authority that can update trading scores.

```typescript
async setTradingAuthority(newAuthority: PublicKey): Promise<string>
```

---

#### setCivicAuthority

Set the authority that can update civic scores.

```typescript
async setCivicAuthority(newAuthority: PublicKey): Promise<string>
```

---

#### setDeveloperAuthority

Set the authority that can update developer scores.

```typescript
async setDeveloperAuthority(newAuthority: PublicKey): Promise<string>
```

---

#### setInfraAuthority

Set the authority that can update infrastructure scores.

```typescript
async setInfraAuthority(newAuthority: PublicKey): Promise<string>
```

---

### Authority Operations

These methods are called by authorized oracles/programs to update scores.

#### updateTradingScore

```typescript
async updateTradingScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
): Promise<string>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| identityOwner | PublicKey | The identity owner's wallet |
| score | number | New score (0-10000) |
| authority | Keypair (optional) | Authority keypair, uses wallet if not provided |

---

#### updateCivicScore

```typescript
async updateCivicScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
): Promise<string>
```

---

#### updateDeveloperScore

```typescript
async updateDeveloperScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
): Promise<string>
```

---

#### updateInfraScore

```typescript
async updateInfraScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
): Promise<string>
```

---

### Static Properties

```typescript
SovereignClient.PROGRAM_ID        // SOVEREIGN program ID
SovereignClient.getIdentityPda    // PDA derivation function
SovereignClient.getTradingDetailsPda
SovereignClient.getCivicDetailsPda
```

---

## PDA Utilities

### getIdentityPda

Derive the PDA for a user's SOVEREIGN identity.

```typescript
function getIdentityPda(owner: PublicKey): [PublicKey, number]
```

**Example**:
```typescript
import { getIdentityPda } from '@sovereign/sdk';

const [identityPda, bump] = getIdentityPda(userPubkey);
```

---

### getTradingDetailsPda

Derive the PDA for trading score details.

```typescript
function getTradingDetailsPda(identity: PublicKey): [PublicKey, number]
```

---

### getCivicDetailsPda

Derive the PDA for civic score details.

```typescript
function getCivicDetailsPda(identity: PublicKey): [PublicKey, number]
```

---

## Type Utilities

### getTierName

Get human-readable tier name.

```typescript
function getTierName(tier: number): string
```

**Example**:
```typescript
import { getTierName } from '@sovereign/sdk';

getTierName(1); // "Bronze"
getTierName(3); // "Gold"
getTierName(5); // "Diamond"
```

---

### getPointsToNextTier

Calculate points needed to reach next tier.

```typescript
function getPointsToNextTier(compositeScore: number, currentTier: number): number
```

**Example**:
```typescript
import { getPointsToNextTier } from '@sovereign/sdk';

const pointsNeeded = getPointsToNextTier(3500, 2);
console.log(`${pointsNeeded} points to Gold tier`); // "500 points to Gold tier"
```

---

## Types

### SovereignIdentity

```typescript
interface SovereignIdentity {
    owner: PublicKey;
    createdAt: BN;
    tradingAuthority: PublicKey;
    civicAuthority: PublicKey;
    developerAuthority: PublicKey;
    infraAuthority: PublicKey;
    tradingScore: number;
    civicScore: number;
    developerScore: number;
    infraScore: number;
    compositeScore: number;
    tier: number;
    lastUpdated: BN;
    bump: number;
}
```

### TradingScoreDetails

```typescript
interface TradingScoreDetails {
    identity: PublicKey;
    winRateBps: number;
    profitFactorBps: number;
    totalTrades: BN;
    totalVolume: BN;
    maxDrawdownBps: number;
    lastUpdated: BN;
    bump: number;
}
```

### CivicScoreDetails

```typescript
interface CivicScoreDetails {
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
```

### TierConfig

```typescript
interface TierConfig {
    tier: number;
    minCompositeScore: number;
    name: string;
}
```

### TIER_CONFIGS

```typescript
const TIER_CONFIGS: TierConfig[] = [
    { tier: 1, minCompositeScore: 0, name: 'Bronze' },
    { tier: 2, minCompositeScore: 2000, name: 'Silver' },
    { tier: 3, minCompositeScore: 4000, name: 'Gold' },
    { tier: 4, minCompositeScore: 6000, name: 'Platinum' },
    { tier: 5, minCompositeScore: 8000, name: 'Diamond' },
];
```

---

## Constants

```typescript
import { SOVEREIGN_PROGRAM_ID } from '@sovereign/sdk';

console.log(SOVEREIGN_PROGRAM_ID.toString());
// "2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T"
```

---

## Error Handling

```typescript
try {
    await client.createIdentity();
} catch (error) {
    if (error.message.includes('already in use')) {
        console.log('Identity already exists');
    } else if (error.message.includes('Unauthorized')) {
        console.log('Not authorized to perform this action');
    } else if (error.message.includes('InvalidScore')) {
        console.log('Score must be between 0 and 10000');
    }
}
```
