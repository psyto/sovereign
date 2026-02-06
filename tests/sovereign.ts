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
});
