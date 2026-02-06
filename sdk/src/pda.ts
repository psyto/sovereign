import { PublicKey } from '@solana/web3.js';

/**
 * SOVEREIGN Program ID
 */
export const SOVEREIGN_PROGRAM_ID = new PublicKey(
  '2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T'
);

/**
 * Derive the PDA for a user's SOVEREIGN identity
 * @param owner - The wallet address of the identity owner
 * @returns [PDA, bump]
 */
export function getIdentityPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), owner.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for trading score details
 * @param identity - The identity PDA
 * @returns [PDA, bump]
 */
export function getTradingDetailsPda(identity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('trading_details'), identity.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for civic score details
 * @param identity - The identity PDA
 * @returns [PDA, bump]
 */
export function getCivicDetailsPda(identity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('civic_details'), identity.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}
