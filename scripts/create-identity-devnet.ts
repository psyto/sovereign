import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, Connection, clusterApiUrl, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T');

// Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
const CREATE_IDENTITY_DISCRIMINATOR = Buffer.from([12, 253, 209, 41, 176, 51, 195, 179]);
const UPDATE_TRADING_SCORE_DISCRIMINATOR = Buffer.from([136, 245, 74, 155, 95, 78, 3, 46]);

async function main() {
  console.log('=== SOVEREIGN Devnet: Create Identity ===\n');

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  console.log('Connected to devnet');

  // Load wallet
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`Wallet: ${wallet.publicKey.toString()}\n`);

  // Derive identity PDA
  const [identityPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`Identity PDA: ${identityPda.toString()}`);

  // Check if identity exists
  let identityInfo = await connection.getAccountInfo(identityPda);

  if (!identityInfo) {
    console.log('\nCreating identity...');

    // Build create_identity instruction
    const createIx = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: identityPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: CREATE_IDENTITY_DISCRIMINATOR,
    };

    const tx = new Transaction().add(createIx);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log(`Transaction: ${sig}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet\n`);

    // Wait a moment and fetch the account
    await new Promise(resolve => setTimeout(resolve, 2000));
    identityInfo = await connection.getAccountInfo(identityPda);
  } else {
    console.log('\nIdentity already exists!\n');
  }

  if (identityInfo) {
    // Parse and display identity
    const data = identityInfo.data;

    const tradingScore = data.readUInt16LE(176);
    const civicScore = data.readUInt16LE(178);
    const developerScore = data.readUInt16LE(180);
    const infraScore = data.readUInt16LE(182);
    const compositeScore = data.readUInt16LE(184);
    const tier = data.readUInt8(186);

    console.log('=== Identity Created ===');
    console.log(`Trading Score:   ${tradingScore}`);
    console.log(`Civic Score:     ${civicScore}`);
    console.log(`Developer Score: ${developerScore}`);
    console.log(`Infra Score:     ${infraScore}`);
    console.log(`Composite Score: ${compositeScore}`);
    console.log(`Tier: ${tier} (${getTierName(tier)})`);

    // Test updating trading score
    if (tradingScore === 0) {
      console.log('\n--- Testing Score Update ---');
      console.log('Updating trading score to 5000...');

      const scoreBuffer = Buffer.alloc(2);
      scoreBuffer.writeUInt16LE(5000, 0);

      const updateIx = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: identityPda, isSigner: false, isWritable: true },
        ],
        data: Buffer.concat([UPDATE_TRADING_SCORE_DISCRIMINATOR, scoreBuffer]),
      };

      const tx = new Transaction().add(updateIx);
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
      console.log(`Transaction: ${sig}`);
      console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet\n`);

      // Fetch updated identity
      await new Promise(resolve => setTimeout(resolve, 2000));
      const updatedInfo = await connection.getAccountInfo(identityPda);
      if (updatedInfo) {
        const newTradingScore = updatedInfo.data.readUInt16LE(176);
        const newCompositeScore = updatedInfo.data.readUInt16LE(184);
        const newTier = updatedInfo.data.readUInt8(186);

        console.log('=== Updated Identity ===');
        console.log(`Trading Score:   ${newTradingScore}`);
        console.log(`Composite Score: ${newCompositeScore} (5000 * 0.40 = 2000)`);
        console.log(`Tier: ${newTier} (${getTierName(newTier)})`);
      }
    }
  }

  console.log('\n=== Test Complete ===');
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
