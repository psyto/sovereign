import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, Connection, clusterApiUrl } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T');

async function main() {
  console.log('=== SOVEREIGN Devnet Verification ===\n');

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  console.log('Connected to devnet');

  // Load wallet from default keypair
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`Wallet: ${wallet.publicKey.toString()}`);

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL\n`);

  // Verify program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    console.error('ERROR: Program not found on devnet!');
    process.exit(1);
  }
  console.log(`Program found: ${PROGRAM_ID.toString()}`);
  console.log(`Program size: ${programInfo.data.length} bytes\n`);

  // Derive identity PDA
  const [identityPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`Identity PDA: ${identityPda.toString()}`);
  console.log(`Bump: ${bump}\n`);

  // Check if identity already exists
  const identityInfo = await connection.getAccountInfo(identityPda);
  if (identityInfo) {
    console.log('Identity already exists! Reading data...\n');

    // Parse identity data manually (since we don't have IDL loaded)
    const data = identityInfo.data;

    // Skip 8-byte discriminator
    const owner = new PublicKey(data.slice(8, 40));
    const createdAt = data.readBigInt64LE(40);

    // Authorities (4 x 32 bytes)
    const tradingAuth = new PublicKey(data.slice(48, 80));
    const civicAuth = new PublicKey(data.slice(80, 112));
    const developerAuth = new PublicKey(data.slice(112, 144));
    const infraAuth = new PublicKey(data.slice(144, 176));

    // Scores (5 x 2 bytes)
    const tradingScore = data.readUInt16LE(176);
    const civicScore = data.readUInt16LE(178);
    const developerScore = data.readUInt16LE(180);
    const infraScore = data.readUInt16LE(182);
    const compositeScore = data.readUInt16LE(184);

    // Tier and timestamp
    const tier = data.readUInt8(186);
    const lastUpdated = data.readBigInt64LE(187);

    console.log('=== Identity Data ===');
    console.log(`Owner: ${owner.toString()}`);
    console.log(`Created: ${new Date(Number(createdAt) * 1000).toISOString()}`);
    console.log(`\nScores:`);
    console.log(`  Trading:   ${tradingScore} / 10000`);
    console.log(`  Civic:     ${civicScore} / 10000`);
    console.log(`  Developer: ${developerScore} / 10000`);
    console.log(`  Infra:     ${infraScore} / 10000`);
    console.log(`  Composite: ${compositeScore} / 10000`);
    console.log(`\nTier: ${tier} (${getTierName(tier)})`);
    console.log(`Last Updated: ${new Date(Number(lastUpdated) * 1000).toISOString()}`);
  } else {
    console.log('Identity does not exist yet.');
    console.log('To create one, run: anchor test --skip-local-validator --provider.cluster devnet');
  }

  console.log('\n=== Verification Complete ===');
  console.log('SOVEREIGN is working on devnet!');
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
