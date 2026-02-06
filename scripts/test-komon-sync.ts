import { PublicKey, Keypair, Connection, clusterApiUrl, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const SOVEREIGN_PROGRAM_ID = new PublicKey('2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T');

// Correct discriminator for update_civic_score (sha256("global:update_civic_score")[0:8])
const UPDATE_CIVIC_SCORE_DISCRIMINATOR = Buffer.from([62, 199, 170, 21, 48, 132, 219, 245]);

/**
 * Calculate civic score from Komon reputation data
 * This mirrors the calculation in Komon's sovereign/mod.rs
 */
function calculateCivicScore(
  problemsPosted: number,
  directionsProposed: number,
  directionsWon: number,
  directionsLost: number,
  winRate: number, // basis points (0-10000)
  currentStreak: number,
  level: number
): number {
  // Win rate component: 40%
  const winRateComponent = Math.floor((winRate * 40) / 100);

  // Directions won tier: 25%
  let solvedTier: number;
  if (directionsWon <= 2) solvedTier = 2000;
  else if (directionsWon <= 10) solvedTier = 4000;
  else if (directionsWon <= 50) solvedTier = 6000;
  else if (directionsWon <= 200) solvedTier = 8000;
  else solvedTier = 10000;
  const solvedComponent = Math.floor((solvedTier * 25) / 100);

  // Level component: 25%
  const levelScore = Math.min(Math.floor((level * 10000) / 50), 10000);
  const levelComponent = Math.floor((levelScore * 25) / 100);

  // Streak component: 10%
  const absStreak = Math.abs(currentStreak);
  let streakTier: number;
  if (absStreak <= 2) streakTier = 2000;
  else if (absStreak <= 5) streakTier = 4000;
  else if (absStreak <= 10) streakTier = 6000;
  else if (absStreak <= 20) streakTier = 8000;
  else streakTier = 10000;
  const streakComponent = currentStreak >= 0
    ? Math.floor((streakTier * 10) / 100)
    : Math.floor((streakTier * 5) / 100);

  return Math.min(winRateComponent + solvedComponent + levelComponent + streakComponent, 10000);
}

async function main() {
  console.log('=== Komon → SOVEREIGN Civic Score Sync Test ===\n');

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`Wallet: ${wallet.publicKey.toString()}`);

  // Derive identity PDA
  const [identityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), wallet.publicKey.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
  console.log(`Identity PDA: ${identityPda.toString()}\n`);

  // Simulate Komon reputation data
  const komonReputation = {
    problemsPosted: 5,
    directionsProposed: 12,
    directionsWon: 8,
    directionsLost: 3,
    winRate: 7272, // 72.72% (8 wins / 11 total)
    currentStreak: 3,
    level: 15,
  };

  console.log('=== Simulated Komon Reputation ===');
  console.log(`Problems Posted:     ${komonReputation.problemsPosted}`);
  console.log(`Directions Proposed: ${komonReputation.directionsProposed}`);
  console.log(`Directions Won:      ${komonReputation.directionsWon}`);
  console.log(`Directions Lost:     ${komonReputation.directionsLost}`);
  console.log(`Win Rate:            ${(komonReputation.winRate / 100).toFixed(2)}%`);
  console.log(`Current Streak:      ${komonReputation.currentStreak}`);
  console.log(`Level:               ${komonReputation.level}`);

  // Calculate civic score
  const civicScore = calculateCivicScore(
    komonReputation.problemsPosted,
    komonReputation.directionsProposed,
    komonReputation.directionsWon,
    komonReputation.directionsLost,
    komonReputation.winRate,
    komonReputation.currentStreak,
    komonReputation.level
  );

  console.log(`\n=== Calculated Civic Score ===`);
  console.log(`Win Rate Component (40%):    ${Math.floor((komonReputation.winRate * 40) / 100)}`);
  console.log(`Solved Component (25%):      ${Math.floor((4000 * 25) / 100)} (8 wins = tier 4000)`);
  console.log(`Level Component (25%):       ${Math.floor((Math.min(Math.floor((komonReputation.level * 10000) / 50), 10000) * 25) / 100)}`);
  console.log(`Streak Component (10%):      ${Math.floor((4000 * 10) / 100)} (3 streak = tier 4000)`);
  console.log(`\nTotal Civic Score: ${civicScore}`);

  // Read current SOVEREIGN identity
  const identityBefore = await connection.getAccountInfo(identityPda);
  if (!identityBefore) {
    console.log('\nERROR: No SOVEREIGN identity found. Create one first.');
    process.exit(1);
  }

  const civicScoreBefore = identityBefore.data.readUInt16LE(178);
  const compositeBefore = identityBefore.data.readUInt16LE(184);
  const tierBefore = identityBefore.data.readUInt8(186);

  console.log(`\n=== Before Sync ===`);
  console.log(`Civic Score:     ${civicScoreBefore}`);
  console.log(`Composite Score: ${compositeBefore}`);
  console.log(`Tier:            ${tierBefore} (${getTierName(tierBefore)})`);

  // Build update_civic_score instruction
  console.log(`\n--- Syncing to SOVEREIGN ---`);
  console.log(`Updating civic score to ${civicScore}...`);

  const scoreBuffer = Buffer.alloc(2);
  scoreBuffer.writeUInt16LE(civicScore, 0);

  const updateIx = {
    programId: SOVEREIGN_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // authority
      { pubkey: identityPda, isSigner: false, isWritable: true },       // identity
    ],
    data: Buffer.concat([UPDATE_CIVIC_SCORE_DISCRIMINATOR, scoreBuffer]),
  };

  const tx = new Transaction().add(updateIx);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log(`Transaction: ${sig}`);
  console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // Wait and fetch updated identity
  await new Promise(resolve => setTimeout(resolve, 2000));
  const identityAfter = await connection.getAccountInfo(identityPda);
  if (!identityAfter) {
    console.log('\nERROR: Failed to fetch updated identity');
    process.exit(1);
  }

  const tradingAfter = identityAfter.data.readUInt16LE(176);
  const civicAfter = identityAfter.data.readUInt16LE(178);
  const developerAfter = identityAfter.data.readUInt16LE(180);
  const infraAfter = identityAfter.data.readUInt16LE(182);
  const compositeAfter = identityAfter.data.readUInt16LE(184);
  const tierAfter = identityAfter.data.readUInt8(186);

  console.log(`\n=== After Sync ===`);
  console.log(`Trading Score:   ${tradingAfter}`);
  console.log(`Civic Score:     ${civicAfter} (was ${civicScoreBefore})`);
  console.log(`Developer Score: ${developerAfter}`);
  console.log(`Infra Score:     ${infraAfter}`);
  console.log(`Composite Score: ${compositeAfter} (was ${compositeBefore})`);
  console.log(`Tier:            ${tierAfter} (${getTierName(tierAfter)}) (was ${tierBefore})`);

  // Verify calculation
  const expectedComposite = Math.floor(
    (tradingAfter * 40 + civicAfter * 25 + developerAfter * 20 + infraAfter * 15) / 100
  );
  console.log(`\n=== Verification ===`);
  console.log(`Expected Composite: ${expectedComposite}`);
  console.log(`Actual Composite:   ${compositeAfter}`);
  console.log(`Match: ${expectedComposite === compositeAfter ? '✅' : '❌'}`);

  console.log(`\n=== Komon → SOVEREIGN Sync Complete ===`);
}

function getTierName(tier: number): string {
  switch (tier) {
    case 1: return 'Bronze';
    case 2: return 'Silver';
    case 3: return 'Gold';
    case 4: return 'Platinum';
    case 5: return 'Diamond';
    default: return 'Unknown';
  }
}

main().catch(console.error);
