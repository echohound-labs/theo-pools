import { Connection, Transaction } from "@solana/web3.js";
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";
import { decodeTxError, TxAction } from "./errors";

export class TxError extends Error {
  sig?: string;
  constructor(message: string, sig?: string) {
    super(message);
    this.name = "TxError";
    this.sig = sig;
  }
}

/**
 * Sends a transaction through the wallet adapter and waits for confirmation.
 * Resolves with the signature only if the transaction actually succeeded on-chain;
 * otherwise throws a TxError with a human-readable message (and the signature, if one exists).
 */
export async function sendAndConfirm(
  tx: Transaction,
  sendTransaction: WalletAdapterProps["sendTransaction"],
  connection: Connection,
  action: TxAction,
): Promise<string> {
  let sig: string;
  try {
    sig = await sendTransaction(tx, connection);
  } catch (e) {
    throw new TxError(decodeTxError(e, action));
  }

  let result;
  try {
    result = tx.recentBlockhash && tx.lastValidBlockHeight
      ? await connection.confirmTransaction({ signature: sig, blockhash: tx.recentBlockhash, lastValidBlockHeight: tx.lastValidBlockHeight }, "confirmed")
      : await connection.confirmTransaction(sig, "confirmed");
  } catch (e) {
    // Timed out or blockhash expired — the outcome is unknown, so never report success.
    throw new TxError("Couldn't confirm the transaction. It may still go through — check the explorer before retrying.", sig);
  }

  if (result.value.err) {
    throw new TxError(decodeTxError(result.value.err, action), sig);
  }
  return sig;
}
