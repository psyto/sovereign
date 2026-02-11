import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import {
  SOVEREIGN_PROGRAM_ID,
  getIdentityPda,
  getTradingDetailsPda,
  getCivicDetailsPda,
  getCreatorDetailsPda,
  getDaoCounterPda,
  getDaoPda,
  getDaoMembershipPda,
  getNominationPda,
  getVoteRecordPda,
  getAdmissionMarketPda,
  getMarketPositionPda,
  getMarketFactoryPda,
  getSurfacingScorePda,
} from './pda';
import {
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
  SurfacingScore,
  CreateDAOParams,
  NominateCreatorParams,
  CreateAdmissionMarketParams,
  TakePositionParams,
  VoteChoice,
} from './types';

/**
 * SOVEREIGN SDK Client
 * Provides methods to interact with the SOVEREIGN identity and reputation protocol
 */
export class SovereignClient {
  public program: any; // Will be properly typed when IDL is available
  public provider: AnchorProvider;

  constructor(provider: AnchorProvider, idl?: Idl) {
    this.provider = provider;
    // Program will be initialized with IDL when available
    // For now, this is a placeholder
    if (idl) {
      this.program = new Program(idl, provider);
    }
  }

  // ============================================
  // Static PDA helpers (re-exported for convenience)
  // ============================================

  static getIdentityPda = getIdentityPda;
  static getTradingDetailsPda = getTradingDetailsPda;
  static getCivicDetailsPda = getCivicDetailsPda;
  static getCreatorDetailsPda = getCreatorDetailsPda;
  static getDaoPda = getDaoPda;
  static getDaoMembershipPda = getDaoMembershipPda;
  static getNominationPda = getNominationPda;
  static getVoteRecordPda = getVoteRecordPda;
  static getAdmissionMarketPda = getAdmissionMarketPda;
  static getMarketPositionPda = getMarketPositionPda;
  static getSurfacingScorePda = getSurfacingScorePda;
  static PROGRAM_ID = SOVEREIGN_PROGRAM_ID;

  // ============================================
  // Read Operations
  // ============================================

  /**
   * Get a user's SOVEREIGN identity
   * @param owner - The wallet address of the identity owner
   * @returns The identity account data, or null if not found
   */
  async getIdentity(owner: PublicKey): Promise<SovereignIdentity | null> {
    const [pda] = getIdentityPda(owner);
    try {
      return await this.program.account.sovereignIdentity.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get a user's tier
   * @param owner - The wallet address
   * @returns Tier number (1-5), defaults to 1 if no identity
   */
  async getTier(owner: PublicKey): Promise<number> {
    const identity = await this.getIdentity(owner);
    return identity?.tier ?? 1;
  }

  /**
   * Get a user's composite score
   * @param owner - The wallet address
   * @returns Composite score (0-10000), defaults to 0 if no identity
   */
  async getCompositeScore(owner: PublicKey): Promise<number> {
    const identity = await this.getIdentity(owner);
    return identity?.compositeScore ?? 0;
  }

  /**
   * Get all scores for a user
   * @param owner - The wallet address
   * @returns All scores, or null if no identity
   */
  async getScores(owner: PublicKey): Promise<Scores | null> {
    const identity = await this.getIdentity(owner);
    if (!identity) return null;

    return {
      trading: identity.tradingScore,
      civic: identity.civicScore,
      developer: identity.developerScore,
      infra: identity.infraScore,
      creator: identity.creatorScore,
      composite: identity.compositeScore,
      tier: identity.tier,
    };
  }

  /**
   * Get trading score details
   * @param owner - The wallet address
   * @returns Detailed trading metrics, or null if not found
   */
  async getTradingDetails(owner: PublicKey): Promise<TradingScoreDetails | null> {
    const [identityPda] = getIdentityPda(owner);
    const [detailsPda] = getTradingDetailsPda(identityPda);
    try {
      return await this.program.account.tradingScoreDetails.fetch(detailsPda);
    } catch {
      return null;
    }
  }

  /**
   * Get civic score details
   * @param owner - The wallet address
   * @returns Detailed civic metrics, or null if not found
   */
  async getCivicDetails(owner: PublicKey): Promise<CivicScoreDetails | null> {
    const [identityPda] = getIdentityPda(owner);
    const [detailsPda] = getCivicDetailsPda(identityPda);
    try {
      return await this.program.account.civicScoreDetails.fetch(detailsPda);
    } catch {
      return null;
    }
  }

  /**
   * Get creator score details
   */
  async getCreatorDetails(owner: PublicKey): Promise<CreatorScoreDetails | null> {
    const [identityPda] = getIdentityPda(owner);
    const [detailsPda] = getCreatorDetailsPda(identityPda);
    try {
      return await this.program.account.creatorScoreDetails.fetch(detailsPda);
    } catch {
      return null;
    }
  }

  /**
   * Get a Creator DAO by founder and ID
   */
  async getDao(founder: PublicKey, daoId: BN | number): Promise<CreatorDAO | null> {
    const [pda] = getDaoPda(founder, daoId);
    try {
      return await this.program.account.creatorDao.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get a DAO membership
   */
  async getDaoMembership(dao: PublicKey, memberWallet: PublicKey): Promise<DAOMembership | null> {
    const [pda] = getDaoMembershipPda(dao, memberWallet);
    try {
      return await this.program.account.daoMembership.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get a nomination
   */
  async getNomination(dao: PublicKey, nonce: BN | number): Promise<Nomination | null> {
    const [pda] = getNominationPda(dao, nonce);
    try {
      return await this.program.account.nomination.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get an admission market
   */
  async getAdmissionMarket(
    dao: PublicKey,
    predictedCreatorIdentity: PublicKey
  ): Promise<AdmissionMarket | null> {
    const [pda] = getAdmissionMarketPda(dao, predictedCreatorIdentity);
    try {
      return await this.program.account.admissionMarket.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get a market position
   */
  async getMarketPosition(market: PublicKey, predictor: PublicKey): Promise<MarketPosition | null> {
    const [pda] = getMarketPositionPda(market, predictor);
    try {
      return await this.program.account.marketPosition.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Get a surfacing score for a talent scout
   */
  async getSurfacingScore(creator: PublicKey): Promise<SurfacingScore | null> {
    const [pda] = getSurfacingScorePda(creator);
    try {
      return await this.program.account.surfacingScore.fetch(pda);
    } catch {
      return null;
    }
  }

  /**
   * Check if a user has a SOVEREIGN identity
   * @param owner - The wallet address
   * @returns True if identity exists
   */
  async hasIdentity(owner: PublicKey): Promise<boolean> {
    const identity = await this.getIdentity(owner);
    return identity !== null;
  }

  // ============================================
  // Write Operations
  // ============================================

  /**
   * Create a new SOVEREIGN identity for the connected wallet
   * @returns Transaction signature
   */
  async createIdentity(): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .createIdentity()
      .accounts({
        owner,
        identity: identityPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Set the trading authority
   * @param newAuthority - The new authority public key
   * @returns Transaction signature
   */
  async setTradingAuthority(newAuthority: PublicKey): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .setTradingAuthority(newAuthority)
      .accounts({
        owner,
        identity: identityPda,
      })
      .rpc();
  }

  /**
   * Set the civic authority
   * @param newAuthority - The new authority public key
   * @returns Transaction signature
   */
  async setCivicAuthority(newAuthority: PublicKey): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .setCivicAuthority(newAuthority)
      .accounts({
        owner,
        identity: identityPda,
      })
      .rpc();
  }

  /**
   * Set the developer authority
   * @param newAuthority - The new authority public key
   * @returns Transaction signature
   */
  async setDeveloperAuthority(newAuthority: PublicKey): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .setDeveloperAuthority(newAuthority)
      .accounts({
        owner,
        identity: identityPda,
      })
      .rpc();
  }

  /**
   * Set the infra authority
   * @param newAuthority - The new authority public key
   * @returns Transaction signature
   */
  async setInfraAuthority(newAuthority: PublicKey): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .setInfraAuthority(newAuthority)
      .accounts({
        owner,
        identity: identityPda,
      })
      .rpc();
  }

  /**
   * Set the creator authority
   */
  async setCreatorAuthority(newAuthority: PublicKey): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [identityPda] = getIdentityPda(owner);

    return this.program.methods
      .setCreatorAuthority(newAuthority)
      .accounts({
        owner,
        identity: identityPda,
      })
      .rpc();
  }

  // ============================================
  // Authority Write Operations
  // (Called by authorized oracles/programs)
  // ============================================

  /**
   * Update trading score (called by trading authority)
   * @param identityOwner - The identity owner's wallet
   * @param score - New score (0-10000)
   * @param authority - Authority keypair (optional, uses wallet if not provided)
   * @returns Transaction signature
   */
  async updateTradingScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
  ): Promise<string> {
    const [identityPda] = getIdentityPda(identityOwner);

    const tx = this.program.methods.updateTradingScore(score).accounts({
      authority: authority?.publicKey ?? this.provider.wallet.publicKey,
      identity: identityPda,
    });

    if (authority) {
      return tx.signers([authority]).rpc();
    }
    return tx.rpc();
  }

  /**
   * Update civic score (called by civic authority)
   * @param identityOwner - The identity owner's wallet
   * @param score - New score (0-10000)
   * @param authority - Authority keypair (optional, uses wallet if not provided)
   * @returns Transaction signature
   */
  async updateCivicScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
  ): Promise<string> {
    const [identityPda] = getIdentityPda(identityOwner);

    const tx = this.program.methods.updateCivicScore(score).accounts({
      authority: authority?.publicKey ?? this.provider.wallet.publicKey,
      identity: identityPda,
    });

    if (authority) {
      return tx.signers([authority]).rpc();
    }
    return tx.rpc();
  }

  /**
   * Update developer score (called by developer authority)
   * @param identityOwner - The identity owner's wallet
   * @param score - New score (0-10000)
   * @param authority - Authority keypair (optional, uses wallet if not provided)
   * @returns Transaction signature
   */
  async updateDeveloperScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
  ): Promise<string> {
    const [identityPda] = getIdentityPda(identityOwner);

    const tx = this.program.methods.updateDeveloperScore(score).accounts({
      authority: authority?.publicKey ?? this.provider.wallet.publicKey,
      identity: identityPda,
    });

    if (authority) {
      return tx.signers([authority]).rpc();
    }
    return tx.rpc();
  }

  /**
   * Update infra score (called by infra authority)
   * @param identityOwner - The identity owner's wallet
   * @param score - New score (0-10000)
   * @param authority - Authority keypair (optional, uses wallet if not provided)
   * @returns Transaction signature
   */
  async updateInfraScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
  ): Promise<string> {
    const [identityPda] = getIdentityPda(identityOwner);

    const tx = this.program.methods.updateInfraScore(score).accounts({
      authority: authority?.publicKey ?? this.provider.wallet.publicKey,
      identity: identityPda,
    });

    if (authority) {
      return tx.signers([authority]).rpc();
    }
    return tx.rpc();
  }

  /**
   * Update creator score (called by creator authority)
   */
  async updateCreatorScore(
    identityOwner: PublicKey,
    score: number,
    authority?: Keypair
  ): Promise<string> {
    const [identityPda] = getIdentityPda(identityOwner);

    const tx = this.program.methods.updateCreatorScore(score).accounts({
      authority: authority?.publicKey ?? this.provider.wallet.publicKey,
      identity: identityPda,
    });

    if (authority) {
      return tx.signers([authority]).rpc();
    }
    return tx.rpc();
  }

  // ============================================
  // Creator DAO Operations
  // ============================================

  /**
   * Create a new Creator DAO
   */
  async createDao(params: CreateDAOParams): Promise<string> {
    const founder = this.provider.wallet.publicKey;
    const [founderIdentity] = getIdentityPda(founder);
    const [daoCounter] = getDaoCounterPda();

    // Read current counter to derive DAO PDA
    const counterAccount = await this.program.account.daoCounter.fetch(daoCounter);
    const [daoPda] = getDaoPda(founder, counterAccount.count);

    return this.program.methods
      .createDao({
        name: params.name,
        description: params.description,
        contentType: { [ContentTypeToAnchor[params.contentType]]: {} },
        styleTag: params.styleTag,
        regionCode: params.regionCode,
        admissionThreshold: params.admissionThreshold,
        votingPeriod: params.votingPeriod,
        quorum: params.quorum,
      })
      .accounts({
        founder,
        founderIdentity,
        dao: daoPda,
        daoCounter,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Add a founder member to a DAO (founder only, during setup phase)
   */
  async addFounderMember(
    daoPda: PublicKey,
    memberWallet: PublicKey
  ): Promise<string> {
    const founder = this.provider.wallet.publicKey;
    const [memberIdentity] = getIdentityPda(memberWallet);
    const [membership] = getDaoMembershipPda(daoPda, memberWallet);

    return this.program.methods
      .addFounderMember()
      .accounts({
        founder,
        dao: daoPda,
        memberIdentity,
        memberWallet,
        membership,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Nominate a creator for DAO admission
   */
  async nominateCreator(
    daoPda: PublicKey,
    nomineeWallet: PublicKey,
    params: NominateCreatorParams
  ): Promise<string> {
    const nominator = this.provider.wallet.publicKey;
    const [nominatorMembership] = getDaoMembershipPda(daoPda, nominator);
    const [nomineeIdentity] = getIdentityPda(nomineeWallet);

    // Read DAO to get current nonce
    const dao = await this.program.account.creatorDao.fetch(daoPda);
    const [nomination] = getNominationPda(daoPda, dao.nominationNonce);

    return this.program.methods
      .nominateCreator({ reason: params.reason })
      .accounts({
        nominator,
        nominatorMembership,
        dao: daoPda,
        nomineeIdentity,
        nomineeWallet,
        nomination,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Cast a vote on a nomination
   * @param salt - 32-byte random salt for semi-anonymous voting
   */
  async castVote(
    daoPda: PublicKey,
    nominationPda: PublicKey,
    vote: VoteChoice,
    salt: Uint8Array
  ): Promise<string> {
    const voter = this.provider.wallet.publicKey;
    const [voterMembership] = getDaoMembershipPda(daoPda, voter);
    const [voteRecord] = getVoteRecordPda(nominationPda, voter);

    const voteArg =
      vote === VoteChoice.Accept
        ? { accept: {} }
        : vote === VoteChoice.Reject
          ? { reject: {} }
          : { abstain: {} };

    return this.program.methods
      .castVote(voteArg, Array.from(salt))
      .accounts({
        voter,
        voterMembership,
        dao: daoPda,
        nomination: nominationPda,
        voteRecord,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Resolve a nomination after voting period ends
   * @param predictionMarket - Optional admission market to resolve alongside
   */
  async resolveNomination(
    daoPda: PublicKey,
    nominationPda: PublicKey,
    nomineeWallet: PublicKey,
    predictionMarket?: PublicKey
  ): Promise<string> {
    const resolver = this.provider.wallet.publicKey;
    const [nomineeIdentity] = getIdentityPda(nomineeWallet);
    const [creatorScore] = getCreatorDetailsPda(nomineeIdentity);
    const [newMembership] = getDaoMembershipPda(daoPda, nomineeWallet);

    // Read nomination to get nominator
    const nomination = await this.program.account.nomination.fetch(nominationPda);
    const [nominatorMembership] = getDaoMembershipPda(daoPda, nomination.nominator);

    return this.program.methods
      .resolveNomination()
      .accounts({
        resolver,
        dao: daoPda,
        nomination: nominationPda,
        nomineeIdentity,
        creatorScore,
        nominatorMembership,
        predictionMarket: predictionMarket ?? null,
        newMembership,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ============================================
  // Admission Market Operations
  // ============================================

  /**
   * Create an admission market (prediction market on creator admission)
   */
  async createMarket(
    daoPda: PublicKey,
    predictedCreatorWallet: PublicKey,
    params: CreateAdmissionMarketParams
  ): Promise<string> {
    const creator = this.provider.wallet.publicKey;
    const [creatorIdentity] = getIdentityPda(creator);
    const [predictedCreatorIdentity] = getIdentityPda(predictedCreatorWallet);
    const [market] = getAdmissionMarketPda(daoPda, predictedCreatorIdentity);
    const [factory] = getMarketFactoryPda();
    const [surfacingScore] = getSurfacingScorePda(creator);

    return this.program.methods
      .createMarket({
        initialLiquidity: params.initialLiquidity,
        expiryDays: params.expiryDays,
      })
      .accounts({
        creator,
        creatorIdentity,
        dao: daoPda,
        predictedCreatorIdentity,
        predictedCreatorWallet,
        market,
        factory,
        surfacingScore,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Take a position in an admission market
   */
  async takePosition(
    marketPda: PublicKey,
    params: TakePositionParams
  ): Promise<string> {
    const predictor = this.provider.wallet.publicKey;
    const [predictorIdentity] = getIdentityPda(predictor);
    const [position] = getMarketPositionPda(marketPda, predictor);

    const sideArg = params.side === 0 ? { yes: {} } : { no: {} };

    return this.program.methods
      .takePosition({
        amount: params.amount,
        side: sideArg,
        minTokens: params.minTokens,
      })
      .accounts({
        predictor,
        predictorIdentity,
        market: marketPda,
        position,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Claim winnings from a resolved admission market
   */
  async claimWinnings(
    marketPda: PublicKey,
    burnTreasury: PublicKey
  ): Promise<string> {
    const predictor = this.provider.wallet.publicKey;
    const [position] = getMarketPositionPda(marketPda, predictor);
    const [creatorScore] = getCreatorDetailsPda(predictor);

    // Read market to get market_creator for surfacing score
    const market = await this.program.account.admissionMarket.fetch(marketPda);
    const [surfacingScore] = getSurfacingScorePda(market.marketCreator);

    return this.program.methods
      .claimWinnings()
      .accounts({
        predictor,
        market: marketPda,
        position,
        creatorScore,
        surfacingScore,
        burnTreasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
}

// ============================================================================
// Helpers
// ============================================================================

const ContentTypeToAnchor: Record<number, string> = {
  0: 'music',
  1: 'visualArt',
  2: 'writing',
  3: 'video',
  4: 'photography',
  5: 'design',
  6: 'gaming',
  7: 'education',
  8: 'technology',
  9: 'other',
};
