# SOVEREIGN Integration Guide

This guide explains how to integrate SOVEREIGN identity and reputation into your Solana program or application.

## Table of Contents

- [Overview](#overview)
- [Reading SOVEREIGN Data](#reading-sovereign-data)
- [Writing to SOVEREIGN](#writing-to-sovereign)
- [Common Integration Patterns](#common-integration-patterns)
- [TypeScript Integration](#typescript-integration)

## Overview

SOVEREIGN can be integrated in two ways:

1. **Read-only**: Your program reads SOVEREIGN identity data for access control, tiered features, etc.
2. **Read-write**: Your program also updates SOVEREIGN scores (requires being set as an authority)

## Reading SOVEREIGN Data

### Account Structure

SOVEREIGN identity is stored as a PDA derived from:
```
seeds = [b"identity", owner_pubkey]
program = SOVEREIGN_PROGRAM_ID
```

### Rust: Cross-Program Account Read

The simplest integration is reading the SOVEREIGN account without CPI:

```rust
use anchor_lang::prelude::*;

// Define the SOVEREIGN identity structure for deserialization
#[account]
pub struct SovereignIdentity {
    pub owner: Pubkey,
    pub created_at: i64,
    pub trading_authority: Pubkey,
    pub civic_authority: Pubkey,
    pub developer_authority: Pubkey,
    pub infra_authority: Pubkey,
    pub trading_score: u16,
    pub civic_score: u16,
    pub developer_score: u16,
    pub infra_score: u16,
    pub composite_score: u16,
    pub tier: u8,
    pub last_updated: i64,
    pub bump: u8,
}

pub const SOVEREIGN_PROGRAM_ID: Pubkey = pubkey!("2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T");

#[derive(Accounts)]
pub struct TieredAccess<'info> {
    pub user: Signer<'info>,

    /// The user's SOVEREIGN identity (optional - may not exist)
    /// CHECK: Validated by seeds constraint
    #[account(
        seeds = [b"identity", user.key().as_ref()],
        seeds::program = SOVEREIGN_PROGRAM_ID,
        bump,
    )]
    pub sovereign_identity: AccountInfo<'info>,
}

pub fn get_user_tier(sovereign_identity: &AccountInfo) -> Result<u8> {
    // Check if account exists and has data
    if sovereign_identity.data_is_empty() {
        return Ok(1); // Default tier for users without SOVEREIGN identity
    }

    // Deserialize the account
    let data = sovereign_identity.try_borrow_data()?;

    // Skip 8-byte discriminator, then parse tier at correct offset
    // Offset: 8 + 32 + 8 + (32*4) + (2*4) + 2 = 186
    let tier_offset = 186;
    if data.len() > tier_offset {
        Ok(data[tier_offset])
    } else {
        Ok(1)
    }
}
```

### Tier-Based Access Control

```rust
#[error_code]
pub enum MyError {
    #[msg("Insufficient SOVEREIGN tier for this action")]
    InsufficientTier,
}

pub fn premium_feature(ctx: Context<TieredAccess>) -> Result<()> {
    let tier = get_user_tier(&ctx.accounts.sovereign_identity)?;

    // Require Gold tier (3) or higher
    require!(tier >= 3, MyError::InsufficientTier);

    // Execute premium feature
    msg!("User tier {} accessing premium feature", tier);
    Ok(())
}
```

### Tier-Based Limits

```rust
pub fn get_stake_limit(tier: u8) -> u64 {
    match tier {
        1 => 100_000_000,        // 100 USDC (6 decimals)
        2 => 500_000_000,        // 500 USDC
        3 => 2_000_000_000,      // 2,000 USDC
        4 => 10_000_000_000,     // 10,000 USDC
        5 => u64::MAX,           // Unlimited
        _ => 100_000_000,
    }
}

pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
    let tier = get_user_tier(&ctx.accounts.sovereign_identity)?;
    let limit = get_stake_limit(tier);

    require!(amount <= limit, MyError::StakeExceedsLimit);

    // Process stake...
    Ok(())
}
```

## Writing to SOVEREIGN

To write scores to SOVEREIGN, your program must be set as an authority for a dimension.

### Becoming an Authority

The identity owner must call `set_*_authority` to authorize your program:

```typescript
// User authorizes your program to update their civic score
await sovereignClient.setCivicAuthority(yourProgramId);
```

### CPI to Update Score

```rust
use anchor_lang::solana_program::{instruction::Instruction, program::invoke};

pub const SOVEREIGN_PROGRAM_ID: Pubkey = pubkey!("2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T");

pub fn update_sovereign_civic_score(
    authority: &AccountInfo,
    identity: &AccountInfo,
    score: u16,
) -> Result<()> {
    // Build instruction data
    // Discriminator for "update_civic_score" + score
    let mut data = Vec::with_capacity(10);
    data.extend_from_slice(&[0x6f, 0x48, 0x91, 0x8f, 0x0c, 0x30, 0x5c, 0x2b]); // discriminator
    data.extend_from_slice(&score.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(authority.key(), true),
        AccountMeta::new(identity.key(), false),
    ];

    let ix = Instruction {
        program_id: SOVEREIGN_PROGRAM_ID,
        accounts,
        data,
    };

    invoke(&ix, &[authority.clone(), identity.clone()])?;

    Ok(())
}
```

### Score Calculation

When updating scores, calculate a value between 0-10000 (basis points):

```rust
/// Calculate civic score from your application's metrics
pub fn calculate_civic_score(
    win_rate_bps: u16,       // 0-10000 (e.g., 6500 = 65%)
    problems_solved: u32,
    current_streak: i16,
    level: u8,
) -> u16 {
    // Weighted formula
    let win_rate_component = (win_rate_bps as u32) * 40 / 100;

    let solved_tier = match problems_solved {
        0..=2 => 2000u32,
        3..=10 => 4000,
        11..=50 => 6000,
        51..=200 => 8000,
        _ => 10000,
    };
    let solved_component = solved_tier * 25 / 100;

    let level_score = ((level as u32) * 10000 / 50).min(10000);
    let level_component = level_score * 25 / 100;

    let streak_component = if current_streak > 0 {
        (current_streak.min(20) as u32) * 500 * 10 / 100
    } else {
        0
    };

    (win_rate_component + solved_component + level_component + streak_component)
        .min(10000) as u16
}
```

## Common Integration Patterns

### Pattern 1: Tiered Privacy (Umbra-style)

```rust
pub fn get_privacy_features(tier: u8) -> PrivacyFeatures {
    match tier {
        1..=2 => PrivacyFeatures {
            stealth_addresses: true,
            daily_limit: 1000_000_000,  // 1000 USDC
            batch_withdrawals: false,
        },
        3 => PrivacyFeatures {
            stealth_addresses: true,
            daily_limit: 10000_000_000, // 10k USDC
            batch_withdrawals: true,
        },
        4..=5 => PrivacyFeatures {
            stealth_addresses: true,
            daily_limit: u64::MAX,       // Unlimited
            batch_withdrawals: true,
        },
        _ => PrivacyFeatures::default(),
    }
}
```

### Pattern 2: Reputation-Gated Features

```rust
pub fn can_propose_direction(tier: u8, composite_score: u16) -> bool {
    // Require Silver tier AND minimum 2500 composite score
    tier >= 2 && composite_score >= 2500
}

pub fn can_become_validator(tier: u8) -> bool {
    // Only Platinum and Diamond can become validators
    tier >= 4
}
```

### Pattern 3: Fee Discounts

```rust
pub fn get_fee_rate(tier: u8, base_fee_bps: u16) -> u16 {
    let discount_bps = match tier {
        1 => 0,
        2 => 500,   // 5% discount
        3 => 1000,  // 10% discount
        4 => 2000,  // 20% discount
        5 => 3000,  // 30% discount
        _ => 0,
    };

    base_fee_bps.saturating_sub(discount_bps)
}
```

## TypeScript Integration

### Reading Identity

```typescript
import { SovereignClient, getIdentityPda } from '@sovereign/sdk';

// Using the SDK
const client = new SovereignClient(provider, idl);
const identity = await client.getIdentity(userPubkey);

if (identity) {
    console.log(`Tier: ${identity.tier}`);
    console.log(`Composite Score: ${identity.compositeScore}`);
}

// Direct PDA derivation (for passing to instructions)
const [identityPda] = getIdentityPda(userPubkey);
```

### Checking Tier in Frontend

```typescript
import { getTierName, getPointsToNextTier } from '@sovereign/sdk';

const scores = await client.getScores(userPubkey);
if (scores) {
    console.log(`Current tier: ${getTierName(scores.tier)}`);
    console.log(`Points to next tier: ${getPointsToNextTier(scores.composite, scores.tier)}`);
}
```

### Syncing Your App's Reputation to SOVEREIGN

```typescript
// Your program is set as civic authority
const civicScore = calculateCivicScore(userStats);

await client.updateCivicScore(
    userPubkey,
    civicScore,
    yourProgramAuthorityKeypair
);
```

## Security Considerations

1. **Authority Verification**: Always verify the caller is the correct authority before accepting CPI calls
2. **Score Validation**: Scores must be 0-10000; reject invalid values
3. **Account Ownership**: Verify the identity account belongs to the expected user
4. **Optional Identity**: Handle cases where users don't have a SOVEREIGN identity (default to tier 1)

## Next Steps

- Review the [SDK documentation](./SDK.md) for TypeScript API details
- Check the test suite for working examples
- Join our Discord for integration support
