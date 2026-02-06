import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { SOVEREIGN_PROGRAM_ID, getIdentityPda, getTradingDetailsPda, getCivicDetailsPda } from './pda';
import { SovereignIdentity, Scores, TradingScoreDetails, CivicScoreDetails } from './types';

// IDL will be loaded dynamically or imported from generated types
// For now, we'll use a minimal interface
interface SovereignProgram {
  account: {
    sovereignIdentity: {
      fetch: (address: PublicKey) => Promise<SovereignIdentity>;
      fetchNullable: (address: PublicKey) => Promise<SovereignIdentity | null>;
    };
    tradingScoreDetails: {
      fetch: (address: PublicKey) => Promise<TradingScoreDetails>;
      fetchNullable: (address: PublicKey) => Promise<TradingScoreDetails | null>;
    };
    civicScoreDetails: {
      fetch: (address: PublicKey) => Promise<CivicScoreDetails>;
      fetchNullable: (address: PublicKey) => Promise<CivicScoreDetails | null>;
    };
  };
  methods: {
    createIdentity: () => any;
    setTradingAuthority: (newAuthority: PublicKey) => any;
    setCivicAuthority: (newAuthority: PublicKey) => any;
    setDeveloperAuthority: (newAuthority: PublicKey) => any;
    setInfraAuthority: (newAuthority: PublicKey) => any;
    updateTradingScore: (score: number) => any;
    updateCivicScore: (score: number) => any;
    updateDeveloperScore: (score: number) => any;
    updateInfraScore: (score: number) => any;
    updateTradingScoreDetailed: (
      winRateBps: number,
      profitFactorBps: number,
      totalTrades: BN,
      totalVolume: BN,
      maxDrawdownBps: number
    ) => any;
    updateCivicScoreDetailed: (
      problemsSolved: BN,
      predictionAccuracyBps: number,
      directionsProposed: BN,
      directionsWon: BN,
      currentStreak: number,
      communityTrust: number
    ) => any;
  };
}

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
}
