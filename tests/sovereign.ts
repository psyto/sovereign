import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { expect } from 'chai';

describe('sovereign', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Sovereign as Program;
  const owner = provider.wallet.publicKey;

  // Test authorities
  const tradingOracle = Keypair.generate();
  const civicProgram = Keypair.generate();
  const developerOracle = Keypair.generate();
  const infraProgram = Keypair.generate();

  let identityPda: PublicKey;
  let identityBump: number;

  before(async () => {
    // Derive identity PDA
    [identityPda, identityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('identity'), owner.toBuffer()],
      program.programId
    );

    // Airdrop to test authorities for transaction fees
    const airdropAmount = 1 * anchor.web3.LAMPORTS_PER_SOL;
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(tradingOracle.publicKey, airdropAmount)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(civicProgram.publicKey, airdropAmount)
    );
  });

  describe('Identity Creation', () => {
    it('creates a new identity', async () => {
      await program.methods
        .createIdentity()
        .accounts({
          owner,
          identity: identityPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);

      expect(identity.owner.toString()).to.equal(owner.toString());
      expect(identity.tier).to.equal(1);
      expect(identity.compositeScore).to.equal(0);
      expect(identity.tradingScore).to.equal(0);
      expect(identity.civicScore).to.equal(0);
      expect(identity.developerScore).to.equal(0);
      expect(identity.infraScore).to.equal(0);

      // Authorities should default to owner
      expect(identity.tradingAuthority.toString()).to.equal(owner.toString());
      expect(identity.civicAuthority.toString()).to.equal(owner.toString());
    });

    it('fails to create duplicate identity', async () => {
      try {
        await program.methods
          .createIdentity()
          .accounts({
            owner,
            identity: identityPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown error');
      } catch (e: any) {
        // Account already exists error
        expect(e.message).to.include('already in use');
      }
    });
  });

  describe('Authority Management', () => {
    it('sets trading authority', async () => {
      await program.methods
        .setTradingAuthority(tradingOracle.publicKey)
        .accounts({
          owner,
          identity: identityPda,
        })
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);
      expect(identity.tradingAuthority.toString()).to.equal(
        tradingOracle.publicKey.toString()
      );
    });

    it('sets civic authority', async () => {
      await program.methods
        .setCivicAuthority(civicProgram.publicKey)
        .accounts({
          owner,
          identity: identityPda,
        })
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);
      expect(identity.civicAuthority.toString()).to.equal(
        civicProgram.publicKey.toString()
      );
    });

    it('fails to set authority from non-owner', async () => {
      const fakeOwner = Keypair.generate();

      // Airdrop to fake owner
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          fakeOwner.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        )
      );

      try {
        await program.methods
          .setTradingAuthority(Keypair.generate().publicKey)
          .accounts({
            owner: fakeOwner.publicKey,
            identity: identityPda,
          })
          .signers([fakeOwner])
          .rpc();
        expect.fail('Should have thrown error');
      } catch (e: any) {
        expect(e.message).to.include('OwnerMismatch');
      }
    });
  });

  describe('Score Updates', () => {
    it('updates trading score from authorized oracle', async () => {
      const score = 7500;

      await program.methods
        .updateTradingScore(score)
        .accounts({
          authority: tradingOracle.publicKey,
          identity: identityPda,
        })
        .signers([tradingOracle])
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);
      expect(identity.tradingScore).to.equal(score);

      // Composite = 7500 * 0.4 = 3000
      expect(identity.compositeScore).to.equal(3000);
      expect(identity.tier).to.equal(2); // 2000-3999 = tier 2
    });

    it('updates civic score from authorized program', async () => {
      const score = 8000;

      await program.methods
        .updateCivicScore(score)
        .accounts({
          authority: civicProgram.publicKey,
          identity: identityPda,
        })
        .signers([civicProgram])
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);
      expect(identity.civicScore).to.equal(score);

      // Composite = 7500 * 0.4 + 8000 * 0.25 = 3000 + 2000 = 5000
      expect(identity.compositeScore).to.equal(5000);
      expect(identity.tier).to.equal(3); // 4000-5999 = tier 3
    });

    it('rejects unauthorized trading score update', async () => {
      const unauthorized = Keypair.generate();

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          unauthorized.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        )
      );

      try {
        await program.methods
          .updateTradingScore(9000)
          .accounts({
            authority: unauthorized.publicKey,
            identity: identityPda,
          })
          .signers([unauthorized])
          .rpc();
        expect.fail('Should have thrown error');
      } catch (e: any) {
        expect(e.message).to.include('Unauthorized');
      }
    });

    it('rejects score above 10000', async () => {
      try {
        await program.methods
          .updateTradingScore(15000)
          .accounts({
            authority: tradingOracle.publicKey,
            identity: identityPda,
          })
          .signers([tradingOracle])
          .rpc();
        expect.fail('Should have thrown error');
      } catch (e: any) {
        expect(e.message).to.include('InvalidScore');
      }
    });
  });

  describe('Composite Score Calculation', () => {
    it('calculates weighted composite correctly', async () => {
      // First, set developer authority
      await program.methods
        .setDeveloperAuthority(developerOracle.publicKey)
        .accounts({
          owner,
          identity: identityPda,
        })
        .rpc();

      // Set infra authority
      await program.methods
        .setInfraAuthority(infraProgram.publicKey)
        .accounts({
          owner,
          identity: identityPda,
        })
        .rpc();

      // Airdrop to authorities
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          developerOracle.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        )
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          infraProgram.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        )
      );

      // Update all scores
      // Trading: 7500 (already set)
      // Civic: 8000 (already set)

      // Developer: 6000
      await program.methods
        .updateDeveloperScore(6000)
        .accounts({
          authority: developerOracle.publicKey,
          identity: identityPda,
        })
        .signers([developerOracle])
        .rpc();

      // Infra: 4000
      await program.methods
        .updateInfraScore(4000)
        .accounts({
          authority: infraProgram.publicKey,
          identity: identityPda,
        })
        .signers([infraProgram])
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);

      // Expected composite:
      // Trading: 7500 * 0.40 = 3000
      // Civic:   8000 * 0.25 = 2000
      // Dev:     6000 * 0.20 = 1200
      // Infra:   4000 * 0.15 = 600
      // Total: 6800
      expect(identity.compositeScore).to.equal(6800);
      expect(identity.tier).to.equal(4); // 6000-7999 = tier 4
    });

    it('reaches tier 5 with high scores', async () => {
      // Update all scores to max
      await program.methods
        .updateTradingScore(10000)
        .accounts({
          authority: tradingOracle.publicKey,
          identity: identityPda,
        })
        .signers([tradingOracle])
        .rpc();

      await program.methods
        .updateCivicScore(10000)
        .accounts({
          authority: civicProgram.publicKey,
          identity: identityPda,
        })
        .signers([civicProgram])
        .rpc();

      await program.methods
        .updateDeveloperScore(10000)
        .accounts({
          authority: developerOracle.publicKey,
          identity: identityPda,
        })
        .signers([developerOracle])
        .rpc();

      await program.methods
        .updateInfraScore(10000)
        .accounts({
          authority: infraProgram.publicKey,
          identity: identityPda,
        })
        .signers([infraProgram])
        .rpc();

      const identity = await program.account.sovereignIdentity.fetch(identityPda);

      // All max: 10000 * (0.4 + 0.25 + 0.2 + 0.15) = 10000
      expect(identity.compositeScore).to.equal(10000);
      expect(identity.tier).to.equal(5);
    });
  });

  // ========================================================================
  // Creator DAO — PDA Derivation Tests
  // ========================================================================

  describe('Creator DAO PDAs', () => {
    it('derives DAO counter PDA', () => {
      const [counterPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_counter')],
        program.programId
      );

      expect(counterPda).to.not.be.null;
      expect(bump).to.be.a('number');

      // Counter PDA is a singleton — same for all callers
      const [counterPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_counter')],
        program.programId
      );
      expect(counterPda.toBase58()).to.equal(counterPda2.toBase58());
    });

    it('derives DAO PDA from founder and counter', () => {
      const founder = Keypair.generate().publicKey;
      const count = 0;
      const countBuf = Buffer.alloc(8);
      countBuf.writeBigUInt64LE(BigInt(count));

      const [daoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_dao'), founder.toBuffer(), countBuf],
        program.programId
      );

      expect(daoPda).to.not.be.null;
    });

    it('different founders produce unique DAO PDAs', () => {
      const count = Buffer.alloc(8);
      count.writeBigUInt64LE(BigInt(0));

      const founder1 = Keypair.generate().publicKey;
      const founder2 = Keypair.generate().publicKey;

      const [dao1] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_dao'), founder1.toBuffer(), count],
        program.programId
      );
      const [dao2] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_dao'), founder2.toBuffer(), count],
        program.programId
      );

      expect(dao1.toBase58()).to.not.equal(dao2.toBase58());
    });

    it('same founder with different counters produces unique DAO PDAs', () => {
      const founder = Keypair.generate().publicKey;

      const count0 = Buffer.alloc(8);
      count0.writeBigUInt64LE(BigInt(0));
      const count1 = Buffer.alloc(8);
      count1.writeBigUInt64LE(BigInt(1));

      const [dao0] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_dao'), founder.toBuffer(), count0],
        program.programId
      );
      const [dao1] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_dao'), founder.toBuffer(), count1],
        program.programId
      );

      expect(dao0.toBase58()).to.not.equal(dao1.toBase58());
    });

    it('derives DAO membership PDA', () => {
      const dao = Keypair.generate().publicKey;
      const member = Keypair.generate().publicKey;

      const [membershipPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_membership'), dao.toBuffer(), member.toBuffer()],
        program.programId
      );

      expect(membershipPda).to.not.be.null;
    });

    it('different members in same DAO have unique membership PDAs', () => {
      const dao = Keypair.generate().publicKey;
      const member1 = Keypair.generate().publicKey;
      const member2 = Keypair.generate().publicKey;

      const [m1] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_membership'), dao.toBuffer(), member1.toBuffer()],
        program.programId
      );
      const [m2] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_membership'), dao.toBuffer(), member2.toBuffer()],
        program.programId
      );

      expect(m1.toBase58()).to.not.equal(m2.toBase58());
    });

    it('same member in different DAOs has unique membership PDAs', () => {
      const dao1 = Keypair.generate().publicKey;
      const dao2 = Keypair.generate().publicKey;
      const member = Keypair.generate().publicKey;

      const [m1] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_membership'), dao1.toBuffer(), member.toBuffer()],
        program.programId
      );
      const [m2] = PublicKey.findProgramAddressSync(
        [Buffer.from('dao_membership'), dao2.toBuffer(), member.toBuffer()],
        program.programId
      );

      expect(m1.toBase58()).to.not.equal(m2.toBase58());
    });
  });

  // ========================================================================
  // Nomination & Voting — PDA Derivation Tests
  // ========================================================================

  describe('Nomination & Voting PDAs', () => {
    it('derives nomination PDA from DAO and nonce', () => {
      const dao = Keypair.generate().publicKey;
      const nonce = Buffer.alloc(8);
      nonce.writeBigUInt64LE(BigInt(0));

      const [nominationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nomination'), dao.toBuffer(), nonce],
        program.programId
      );

      expect(nominationPda).to.not.be.null;
    });

    it('different nonces produce unique nomination PDAs', () => {
      const dao = Keypair.generate().publicKey;

      const nonce0 = Buffer.alloc(8);
      nonce0.writeBigUInt64LE(BigInt(0));
      const nonce1 = Buffer.alloc(8);
      nonce1.writeBigUInt64LE(BigInt(1));

      const [nom0] = PublicKey.findProgramAddressSync(
        [Buffer.from('nomination'), dao.toBuffer(), nonce0],
        program.programId
      );
      const [nom1] = PublicKey.findProgramAddressSync(
        [Buffer.from('nomination'), dao.toBuffer(), nonce1],
        program.programId
      );

      expect(nom0.toBase58()).to.not.equal(nom1.toBase58());
    });

    it('derives vote record PDA from nomination and voter', () => {
      const nomination = Keypair.generate().publicKey;
      const voter = Keypair.generate().publicKey;

      const [votePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), nomination.toBuffer(), voter.toBuffer()],
        program.programId
      );

      expect(votePda).to.not.be.null;
    });

    it('each voter gets unique vote record per nomination', () => {
      const nomination = Keypair.generate().publicKey;
      const voter1 = Keypair.generate().publicKey;
      const voter2 = Keypair.generate().publicKey;

      const [vote1] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), nomination.toBuffer(), voter1.toBuffer()],
        program.programId
      );
      const [vote2] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), nomination.toBuffer(), voter2.toBuffer()],
        program.programId
      );

      expect(vote1.toBase58()).to.not.equal(vote2.toBase58());
    });

    it('same voter in different nominations gets unique vote records', () => {
      const nom1 = Keypair.generate().publicKey;
      const nom2 = Keypair.generate().publicKey;
      const voter = Keypair.generate().publicKey;

      const [vote1] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), nom1.toBuffer(), voter.toBuffer()],
        program.programId
      );
      const [vote2] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), nom2.toBuffer(), voter.toBuffer()],
        program.programId
      );

      expect(vote1.toBase58()).to.not.equal(vote2.toBase58());
    });
  });

  // ========================================================================
  // Admission Market — PDA Derivation Tests
  // ========================================================================

  describe('Admission Market PDAs', () => {
    it('derives market PDA from DAO and creator identity', () => {
      const dao = Keypair.generate().publicKey;
      const creatorIdentity = Keypair.generate().publicKey;

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admission_market'), dao.toBuffer(), creatorIdentity.toBuffer()],
        program.programId
      );

      expect(marketPda).to.not.be.null;
    });

    it('different creators in same DAO produce unique market PDAs', () => {
      const dao = Keypair.generate().publicKey;
      const creator1 = Keypair.generate().publicKey;
      const creator2 = Keypair.generate().publicKey;

      const [market1] = PublicKey.findProgramAddressSync(
        [Buffer.from('admission_market'), dao.toBuffer(), creator1.toBuffer()],
        program.programId
      );
      const [market2] = PublicKey.findProgramAddressSync(
        [Buffer.from('admission_market'), dao.toBuffer(), creator2.toBuffer()],
        program.programId
      );

      expect(market1.toBase58()).to.not.equal(market2.toBase58());
    });

    it('same creator in different DAOs produces unique market PDAs', () => {
      const dao1 = Keypair.generate().publicKey;
      const dao2 = Keypair.generate().publicKey;
      const creator = Keypair.generate().publicKey;

      const [market1] = PublicKey.findProgramAddressSync(
        [Buffer.from('admission_market'), dao1.toBuffer(), creator.toBuffer()],
        program.programId
      );
      const [market2] = PublicKey.findProgramAddressSync(
        [Buffer.from('admission_market'), dao2.toBuffer(), creator.toBuffer()],
        program.programId
      );

      expect(market1.toBase58()).to.not.equal(market2.toBase58());
    });

    it('derives market factory PDA (singleton)', () => {
      const [factoryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_factory')],
        program.programId
      );

      // Singleton — same for all callers
      const [factoryPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_factory')],
        program.programId
      );

      expect(factoryPda.toBase58()).to.equal(factoryPda2.toBase58());
    });

    it('derives market position PDA from market and predictor', () => {
      const market = Keypair.generate().publicKey;
      const predictor = Keypair.generate().publicKey;

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_position'), market.toBuffer(), predictor.toBuffer()],
        program.programId
      );

      expect(positionPda).to.not.be.null;
    });

    it('different predictors get unique position PDAs per market', () => {
      const market = Keypair.generate().publicKey;
      const pred1 = Keypair.generate().publicKey;
      const pred2 = Keypair.generate().publicKey;

      const [pos1] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_position'), market.toBuffer(), pred1.toBuffer()],
        program.programId
      );
      const [pos2] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_position'), market.toBuffer(), pred2.toBuffer()],
        program.programId
      );

      expect(pos1.toBase58()).to.not.equal(pos2.toBase58());
    });

    it('derives surfacing score PDA from creator', () => {
      const creator = Keypair.generate().publicKey;

      const [scorePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('surfacing_score'), creator.toBuffer()],
        program.programId
      );

      expect(scorePda).to.not.be.null;

      // Deterministic
      const [scorePda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('surfacing_score'), creator.toBuffer()],
        program.programId
      );
      expect(scorePda.toBase58()).to.equal(scorePda2.toBase58());
    });

    it('different creators get unique surfacing score PDAs', () => {
      const creator1 = Keypair.generate().publicKey;
      const creator2 = Keypair.generate().publicKey;

      const [score1] = PublicKey.findProgramAddressSync(
        [Buffer.from('surfacing_score'), creator1.toBuffer()],
        program.programId
      );
      const [score2] = PublicKey.findProgramAddressSync(
        [Buffer.from('surfacing_score'), creator2.toBuffer()],
        program.programId
      );

      expect(score1.toBase58()).to.not.equal(score2.toBase58());
    });
  });
});
