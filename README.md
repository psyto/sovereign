# SOVEREIGN

Universal identity and multi-dimensional reputation protocol on Solana.

## Overview

SOVEREIGN provides a portable, on-chain identity with multi-dimensional reputation scores. Instead of siloed reputation in each application, SOVEREIGN aggregates reputation across different domains into a single, universal identity that any application can read and trusted authorities can write to.

### Key Features

- **Multi-dimensional Reputation**: Four distinct score dimensions (Trading, Civic, Developer, Infrastructure)
- **Weighted Composite Score**: Automatically calculated from dimension scores (0-10000 scale)
- **5-Tier System**: Bronze, Silver, Gold, Platinum, Diamond based on composite score
- **Authority-based Access Control**: Each dimension has its own trusted authority
- **Portable Identity**: Any application can read; authorized programs can write

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SOVEREIGN Identity                        │
├─────────────────────────────────────────────────────────────┤
│  Owner: [wallet pubkey]                                      │
│  Created: [timestamp]                                        │
├─────────────────────────────────────────────────────────────┤
│  Dimension Scores (0-10000)         │  Authorities          │
│  ─────────────────────────────────  │  ───────────────────  │
│  Trading:    7500  (40% weight)     │  Dverse Oracle        │
│  Civic:      8000  (25% weight)     │  Komon Program        │
│  Developer:  6000  (20% weight)     │  Earn-Agent Oracle    │
│  Infra:      4000  (15% weight)     │  DePINfinity Program  │
├─────────────────────────────────────────────────────────────┤
│  Composite Score: 6800                                       │
│  Tier: 4 (Platinum)                                          │
└─────────────────────────────────────────────────────────────┘
```

## Tier System

| Tier | Name     | Composite Score | Description           |
|------|----------|-----------------|----------------------|
| 1    | Bronze   | 0 - 1999        | New participant      |
| 2    | Silver   | 2000 - 3999     | Active participant   |
| 3    | Gold     | 4000 - 5999     | Established member   |
| 4    | Platinum | 6000 - 7999     | Trusted contributor  |
| 5    | Diamond  | 8000 - 10000    | Elite status         |

## Score Dimensions

### Trading (40% weight)
Measures trading performance and risk management.
- Win rate, profit factor, volume, drawdown, consistency
- Authority: Trading analytics oracle (e.g., Dverse)

### Civic (25% weight)
Measures civic participation and community contribution.
- Problems solved, prediction accuracy, directions proposed/won, streaks
- Authority: Civic prediction market (e.g., Komon)

### Developer (20% weight)
Measures code contribution and development reputation.
- Code reviews, commits, issue resolutions, quality metrics
- Authority: Developer reputation oracle (e.g., Earn-Agent)

### Infrastructure (15% weight)
Measures infrastructure contribution to the network.
- Uptime, data served, network reliability, staking
- Authority: DePIN protocol (e.g., DePINfinity)

## Installation

### Program

```bash
# Clone the repository
git clone https://github.com/psyto/sovereign.git
cd sovereign

# Install dependencies
npm install

# Build the program
anchor build

# Run tests
anchor test
```

### SDK

```bash
npm install @sovereign/sdk
```

## Usage

### Creating an Identity

```typescript
import { SovereignClient } from '@sovereign/sdk';
import { AnchorProvider } from '@coral-xyz/anchor';

const provider = AnchorProvider.env();
const client = new SovereignClient(provider, idl);

// Create identity (one per wallet)
const tx = await client.createIdentity();
```

### Reading Identity Data

```typescript
// Get full identity
const identity = await client.getIdentity(walletPubkey);

// Get just the tier
const tier = await client.getTier(walletPubkey);

// Get all scores
const scores = await client.getScores(walletPubkey);
// { trading: 7500, civic: 8000, developer: 6000, infra: 4000, composite: 6800, tier: 4 }
```

### Setting Authorities (Owner Only)

```typescript
// Set which oracle/program can update each dimension
await client.setTradingAuthority(dverseOraclePubkey);
await client.setCivicAuthority(komonProgramPubkey);
await client.setDeveloperAuthority(earnAgentOraclePubkey);
await client.setInfraAuthority(depinfinityProgramPubkey);
```

### Updating Scores (Authority Only)

```typescript
// Called by the authorized oracle/program
await client.updateTradingScore(identityOwner, 7500, authorityKeypair);
await client.updateCivicScore(identityOwner, 8000, authorityKeypair);
```

### PDA Derivation

```typescript
import { getIdentityPda, SOVEREIGN_PROGRAM_ID } from '@sovereign/sdk';

const [identityPda, bump] = getIdentityPda(ownerPubkey);
```

## Integration Examples

### Reading SOVEREIGN in Your Program

```rust
// In your Solana program, read SOVEREIGN identity without CPI
use sovereign::state::SovereignIdentity;

#[derive(Accounts)]
pub struct MyInstruction<'info> {
    pub user: Signer<'info>,

    /// CHECK: SOVEREIGN identity account (read-only)
    #[account(
        seeds = [b"identity", user.key().as_ref()],
        seeds::program = sovereign::ID,
        bump,
    )]
    pub sovereign_identity: AccountInfo<'info>,
}

pub fn handler(ctx: Context<MyInstruction>) -> Result<()> {
    // Deserialize and read tier
    let identity_data = ctx.accounts.sovereign_identity.try_borrow_data()?;
    let identity: SovereignIdentity = SovereignIdentity::try_deserialize(&mut &identity_data[..])?;

    // Use tier for access control
    require!(identity.tier >= 3, MyError::InsufficientTier);

    Ok(())
}
```

### Writing to SOVEREIGN via CPI

```rust
// Update civic score from your program
use anchor_lang::solana_program::program::invoke;

let ix = sovereign::instruction::update_civic_score(score);
invoke(
    &ix,
    &[authority.to_account_info(), identity.to_account_info()],
)?;
```

## Program IDs

| Network  | Program ID                                   |
|----------|---------------------------------------------|
| Localnet | `2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T` |
| Devnet   | `2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T` |
| Mainnet  | TBD                                          |

## Account Sizes

| Account              | Size (bytes) |
|---------------------|--------------|
| SovereignIdentity   | 200          |
| TradingScoreDetails | 71           |
| CivicScoreDetails   | 81           |

## Integrated Applications

SOVEREIGN is integrated with the following applications:

| Application | Integration | Description |
|-------------|-------------|-------------|
| [Komon](https://github.com/psyto/komon) | Civic Score Writer | Civic prediction market syncs participation scores |
| [Umbra](https://github.com/psyto/veil) | Tier Reader | Privacy DEX reads tier for fee discounts & MEV protection |

### Komon Integration

Komon syncs your civic participation to SOVEREIGN's Civic dimension. Users can sync directly from the Komon profile page with a single click.

**Civic Score Calculation:**

| Metric | Weight | Description |
|--------|--------|-------------|
| Win Rate | 40% | Prediction accuracy on directions |
| Directions Won | 25% | Tier based on successful predictions |
| Level/Trust | 25% | Komon level as trust proxy |
| Current Streak | 10% | Consecutive win bonus |

```typescript
import { syncToSovereign } from '@/lib/solana/sovereign';

// Sync Komon reputation to SOVEREIGN civic score
const result = await syncToSovereign(connection, wallet, {
  winRate: 77.8,
  directionsWon: 28,
  directionsProposed: 45,
  currentStreak: 5,
  level: 15,
});
// result: { txId: "...", newScore: 6850, needsSetup: false }
```

**First-time sync:** If the user hasn't set a civic authority yet, Komon automatically sets the user as their own authority before updating the score.

### Umbra Integration

Umbra reads your SOVEREIGN tier to determine trading benefits:

```typescript
// Umbra fetches SOVEREIGN identity for tier-based fees
const identity = await fetchSovereignIdentity(connection, wallet);
const feeBps = getFeeBps(identity.tier); // 3-50 bps based on tier
```

---

## Scripts

Test scripts are available in the `scripts/` directory:

```bash
# Verify devnet deployment
npx ts-node scripts/verify-devnet.ts

# Create identity on devnet
npx ts-node scripts/create-identity-devnet.ts

# Test Komon → SOVEREIGN sync
npx ts-node scripts/test-komon-sync.ts

# Test Umbra reading SOVEREIGN tier
npx ts-node scripts/test-umbra-read.ts
```

---

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main branch.
