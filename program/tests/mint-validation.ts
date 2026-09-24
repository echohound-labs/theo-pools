// Run on a FRESH ledger, before any other test file has called initialize —
// every case here must be rejected, so no GlobalState is ever created.
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheoCommitmentPool } from "../target/types/theo_commitment_pool";
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen, createMint,
  createInitializeMintInstruction, createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

describe("initialize: mint validation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TheoCommitmentPool as Program<TheoCommitmentPool>;
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;
  const globalStatePDA = PublicKey.findProgramAddressSync([Buffer.from("global")], program.programId)[0];
  const rolloverVaultPDA = PublicKey.findProgramAddressSync([Buffer.from("rollover_vault")], program.programId)[0];

  async function mintWithExtension(ext: ExtensionType, extIx: (mint: PublicKey) => anchor.web3.TransactionInstruction) {
    const mint = Keypair.generate();
    const len = getMintLen([ext]);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey, newAccountPubkey: mint.publicKey, space: len,
        lamports: await connection.getMinimumBalanceForRentExemption(len), programId: TOKEN_2022_PROGRAM_ID,
      }),
      extIx(mint.publicKey),
      createInitializeMintInstruction(mint.publicKey, 2, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, tx, [authority.payer, mint], { commitment: "confirmed" });
    return mint.publicKey;
  }

  async function expectInitRejected(tokenMint: PublicKey, code: string) {
    try {
      await program.methods.initialize().accounts({
        authority: authority.publicKey, globalState: globalStatePDA, tokenMint,
        rolloverVault: rolloverVaultPDA, tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (err: any) {
      assert.include(String(err.error?.errorCode?.code || err.message), code);
      return;
    }
    assert.fail("initialize should have been rejected with " + code);
  }

  it("rejects a mint with a transfer fee", async () => {
    const mint = await mintWithExtension(ExtensionType.TransferFeeConfig, (m) =>
      createInitializeTransferFeeConfigInstruction(m, authority.publicKey, authority.publicKey, 100, 1000n, TOKEN_2022_PROGRAM_ID));
    await expectInitRejected(mint, "UnsupportedMintExtension");
  });

  it("rejects a mint with a permanent delegate", async () => {
    const mint = await mintWithExtension(ExtensionType.PermanentDelegate, (m) =>
      createInitializePermanentDelegateInstruction(m, authority.publicKey, TOKEN_2022_PROGRAM_ID));
    await expectInitRejected(mint, "UnsupportedMintExtension");
  });

  it("rejects a mint with a freeze authority", async () => {
    const mint = await createMint(connection, authority.payer, authority.publicKey, authority.publicKey, 2,
      undefined, { commitment: "confirmed" }, TOKEN_2022_PROGRAM_ID);
    await expectInitRejected(mint, "MintHasFreezeAuthority");
  });
});
