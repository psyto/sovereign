import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

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

/**
 * Derive the PDA for creator score details
 */
export function getCreatorDetailsPda(identity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('creator_details'), identity.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

// ============================================================================
// Creator DAO PDAs
// ============================================================================

/**
 * Derive the PDA for the DAO counter (singleton)
 */
export function getDaoCounterPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('dao_counter')],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a Creator DAO
 * @param founder - The founder's wallet
 * @param daoId - The DAO counter value at creation time
 */
export function getDaoPda(founder: PublicKey, daoId: BN | number): [PublicKey, number] {
  const id = typeof daoId === 'number' ? new BN(daoId) : daoId;
  return PublicKey.findProgramAddressSync(
    [Buffer.from('creator_dao'), founder.toBuffer(), id.toArrayLike(Buffer, 'le', 8)],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a DAO membership
 * @param dao - The DAO PDA
 * @param memberWallet - The member's wallet
 */
export function getDaoMembershipPda(dao: PublicKey, memberWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('dao_membership'), dao.toBuffer(), memberWallet.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a nomination
 * @param dao - The DAO PDA
 * @param nonce - The nomination nonce from the DAO
 */
export function getNominationPda(dao: PublicKey, nonce: BN | number): [PublicKey, number] {
  const n = typeof nonce === 'number' ? new BN(nonce) : nonce;
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nomination'), dao.toBuffer(), n.toArrayLike(Buffer, 'le', 8)],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a vote record
 * @param nomination - The nomination PDA
 * @param voter - The voter's wallet
 */
export function getVoteRecordPda(nomination: PublicKey, voter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vote_record'), nomination.toBuffer(), voter.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

// ============================================================================
// Admission Market PDAs
// ============================================================================

/**
 * Derive the PDA for an admission market
 * @param dao - The DAO PDA
 * @param predictedCreatorIdentity - The predicted creator's identity PDA
 */
export function getAdmissionMarketPda(
  dao: PublicKey,
  predictedCreatorIdentity: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('admission_market'), dao.toBuffer(), predictedCreatorIdentity.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a market position
 * @param market - The admission market PDA
 * @param predictor - The predictor's wallet
 */
export function getMarketPositionPda(market: PublicKey, predictor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_position'), market.toBuffer(), predictor.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for the market factory (singleton)
 */
export function getMarketFactoryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_factory')],
    SOVEREIGN_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a surfacing score
 * @param creator - The talent scout's wallet
 */
export function getSurfacingScorePda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('surfacing_score'), creator.toBuffer()],
    SOVEREIGN_PROGRAM_ID
  );
}
