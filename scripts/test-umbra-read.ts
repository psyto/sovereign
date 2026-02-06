import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const SOVEREIGN_PROGRAM_ID = new PublicKey('2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T');

/**
 * Convert SOVEREIGN tier (1-5) to Umbra tier index (0-4)
 * This mirrors the logic in Umbra's sovereign/mod.rs
 */
function sovereignTierToUmbraIndex(sovereignTier: number): number {
  switch (sovereignTier) {
    case 1: return 0;  // Bronze -> None (lowest tier)
    case 2: return 1;  // Silver -> Bronze
    case 3: return 2;  // Gold -> Silver
    case 4: return 3;  // Platinum -> Gold
    case 5: return 4;  // Diamond -> Diamond
    default: return 0;
  }
}

/**
 * Get Umbra tier name from index
 */
function getUmbraTierName(index: number): string {
  const names = ['None', 'Bronze', 'Silver', 'Gold', 'Diamond'];
  return names[index] || 'Unknown';
}

/**
 * Get SOVEREIGN tier name
 */
function getSovereignTierName(tier: number): string {
  const names = ['Unknown', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  return names[tier] || 'Unknown';
}

/**
 * Get privacy benefits based on SOVEREIGN tier
 * This mirrors Umbra's get_privacy_benefits function
 */
function getPrivacyBenefits(sovereignTier: number) {
  switch (sovereignTier) {
    case 1:
      return {
        feeDiscountBps: 0,
        maxOrderSize: 1_000_000_000,      // 1,000 USDC
        batchWithdrawals: false,
        darkPoolAccess: false,
        priorityExecution: false,
      };
    case 2:
      return {
        feeDiscountBps: 500,              // 5% discount
        maxOrderSize: 10_000_000_000,     // 10,000 USDC
        batchWithdrawals: false,
        darkPoolAccess: false,
        priorityExecution: false,
      };
    case 3:
      return {
        feeDiscountBps: 1500,             // 15% discount
        maxOrderSize: 100_000_000_000,    // 100,000 USDC
        batchWithdrawals: true,
        darkPoolAccess: false,
        priorityExecution: false,
      };
    case 4:
      return {
        feeDiscountBps: 3000,             // 30% discount
        maxOrderSize: 1_000_000_000_000,  // 1,000,000 USDC
        batchWithdrawals: true,
        darkPoolAccess: true,
        priorityExecution: false,
      };
    case 5:
      return {
        feeDiscountBps: 5000,             // 50% discount
        maxOrderSize: Number.MAX_SAFE_INTEGER,
        batchWithdrawals: true,
        darkPoolAccess: true,
        priorityExecution: true,
      };
    default:
      return {
        feeDiscountBps: 0,
        maxOrderSize: 1_000_000_000,
        batchWithdrawals: false,
        darkPoolAccess: false,
        priorityExecution: false,
      };
  }
}

/**
 * Umbra base fee rates by tier (in basis points)
 */
function getUmbraBaseFee(umbraTierIndex: number): number {
  const fees = [50, 30, 15, 8, 5]; // None, Bronze, Silver, Gold, Diamond
  return fees[umbraTierIndex] || 50;
}

/**
 * Get MEV protection level
 */
function getMevProtection(umbraTierIndex: number): string {
  const levels = ['None', 'Basic', 'Full', 'Full + Priority', 'VIP Routing'];
  return levels[umbraTierIndex] || 'None';
}

/**
 * Get allowed order types
 */
function getAllowedOrderTypes(umbraTierIndex: number): string[] {
  const baseTypes = ['Market'];
  if (umbraTierIndex >= 1) baseTypes.push('Limit');
  if (umbraTierIndex >= 2) baseTypes.push('TWAP');
  if (umbraTierIndex >= 3) baseTypes.push('Iceberg');
  if (umbraTierIndex >= 4) baseTypes.push('Dark Pool');
  return baseTypes;
}

async function main() {
  console.log('=== Umbra Reading SOVEREIGN Tier Test ===\n');

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const walletPubkey = new PublicKey(
    require('@solana/web3.js').Keypair.fromSecretKey(
      Uint8Array.from(keypairData)
    ).publicKey
  );
  console.log(`User Wallet: ${walletPubkey.toString()}`);

  // Derive identity PDA (same as Umbra would do)
  const [identityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), walletPubkey.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
  console.log(`SOVEREIGN Identity PDA: ${identityPda.toString()}\n`);

  // Read SOVEREIGN identity (simulating Umbra's read_sovereign_tier)
  const identityInfo = await connection.getAccountInfo(identityPda);

  if (!identityInfo) {
    console.log('No SOVEREIGN identity found.');
    console.log('Umbra would treat this user as Tier 1 (Bronze) with default limits.\n');

    const defaultBenefits = getPrivacyBenefits(1);
    console.log('=== Default Umbra Access (No SOVEREIGN) ===');
    console.log(`Fee:              0.50% (no discount)`);
    console.log(`Max Order:        $${(defaultBenefits.maxOrderSize / 1_000_000).toLocaleString()} USDC`);
    console.log(`MEV Protection:   None`);
    console.log(`Order Types:      Market only`);
    return;
  }

  // Parse SOVEREIGN identity data
  const data = identityInfo.data;
  const tradingScore = data.readUInt16LE(176);
  const civicScore = data.readUInt16LE(178);
  const developerScore = data.readUInt16LE(180);
  const infraScore = data.readUInt16LE(182);
  const compositeScore = data.readUInt16LE(184);
  const sovereignTier = data.readUInt8(186);

  console.log('=== SOVEREIGN Identity Data ===');
  console.log(`Trading Score:   ${tradingScore}`);
  console.log(`Civic Score:     ${civicScore}`);
  console.log(`Developer Score: ${developerScore}`);
  console.log(`Infra Score:     ${infraScore}`);
  console.log(`Composite Score: ${compositeScore}`);
  console.log(`SOVEREIGN Tier:  ${sovereignTier} (${getSovereignTierName(sovereignTier)})`);

  // Map to Umbra tier
  const umbraTierIndex = sovereignTierToUmbraIndex(sovereignTier);
  const benefits = getPrivacyBenefits(sovereignTier);
  const baseFee = getUmbraBaseFee(umbraTierIndex);
  const discountedFee = Math.max(baseFee - Math.floor(benefits.feeDiscountBps / 100), 0);

  console.log(`\n=== Umbra Tier Mapping ===`);
  console.log(`SOVEREIGN Tier ${sovereignTier} (${getSovereignTierName(sovereignTier)}) → Umbra Tier ${umbraTierIndex} (${getUmbraTierName(umbraTierIndex)})`);

  console.log(`\n=== Umbra Benefits for This User ===`);
  console.log(`┌─────────────────────────────────────────────────────────┐`);
  console.log(`│ Base Fee:         0.${baseFee.toString().padStart(2, '0')}%                                  │`);
  console.log(`│ Fee Discount:     ${(benefits.feeDiscountBps / 100).toFixed(0)}% (SOVEREIGN Tier ${sovereignTier} bonus)          │`);
  console.log(`│ Final Fee:        0.${discountedFee.toString().padStart(2, '0')}%                                  │`);
  console.log(`├─────────────────────────────────────────────────────────┤`);

  const maxOrderDisplay = benefits.maxOrderSize >= Number.MAX_SAFE_INTEGER
    ? 'Unlimited'
    : `$${(benefits.maxOrderSize / 1_000_000).toLocaleString()} USDC`;
  console.log(`│ Max Order Size:   ${maxOrderDisplay.padEnd(38)}│`);
  console.log(`│ MEV Protection:   ${getMevProtection(umbraTierIndex).padEnd(38)}│`);
  console.log(`│ Order Types:      ${getAllowedOrderTypes(umbraTierIndex).join(', ').padEnd(38)}│`);
  console.log(`├─────────────────────────────────────────────────────────┤`);
  console.log(`│ Batch Withdrawals: ${benefits.batchWithdrawals ? '✅ Yes' : '❌ No'}                              │`);
  console.log(`│ Dark Pool Access:  ${benefits.darkPoolAccess ? '✅ Yes' : '❌ No'}                              │`);
  console.log(`│ Priority Execution:${benefits.priorityExecution ? '✅ Yes' : '❌ No'}                              │`);
  console.log(`└─────────────────────────────────────────────────────────┘`);

  // Show what would happen with a sample order
  console.log(`\n=== Sample Order Simulation ===`);
  const sampleOrderSize = 1000_000_000; // 1000 USDC
  const fee = Math.floor(sampleOrderSize * discountedFee / 10000);
  console.log(`Order: Swap 1,000 USDC → SOL`);
  console.log(`Fee:   ${(fee / 1_000_000).toFixed(2)} USDC (${discountedFee} bps)`);

  if (benefits.feeDiscountBps > 0) {
    const originalFee = Math.floor(sampleOrderSize * baseFee / 10000);
    const savings = originalFee - fee;
    console.log(`Saved: ${(savings / 1_000_000).toFixed(2)} USDC (thanks to SOVEREIGN tier)`);
  }

  console.log(`\n=== Test Complete ===`);
}

main().catch(console.error);
