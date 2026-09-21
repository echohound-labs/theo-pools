// Human-readable decoding of transaction failures.
//
// The on-chain program declares a separate #[error_code] enum per instruction, and every one of
// them starts at 6000 — so the same code means different things depending on which instruction
// ran (and idl.json only carries the withdraw enum). Codes are therefore mapped per action here,
// mirroring the enum order in program/programs/theo-commitment-pool/src/instructions/*.rs.

export type TxAction = "join" | "exit" | "claim" | "withdraw" | "close" | "finalize" | "sweep" | "redistribution" | "create";

const UNAUTHORIZED = "This position belongs to a different wallet.";
const MISMATCH = "This position does not belong to this pool.";
const OVERFLOW = "The program hit an arithmetic error. Please report this.";

const PROGRAM_ERRORS: Record<TxAction, string[]> = {
  join: [
    "This pool is no longer accepting players.",
    "This pool is not the currently open filling pool.",
    "The fill window has expired — this pool is stalled and can't be joined.",
    "This pool is already full.",
    OVERFLOW,
    OVERFLOW,
  ],
  exit: [
    "Early exit is only available while the game is active.",
    "The game has already ended — early exit is no longer available. Claim your rewards instead.",
    "You have already exited this pool.",
    "You already withdrew from this pool during the filling phase.",
    "You have already claimed your rewards.",
    OVERFLOW,
    OVERFLOW,
    UNAUTHORIZED,
    MISMATCH,
  ],
  claim: [
    "You exited early, so there is nothing to claim.",
    "You withdrew during the filling phase, so there is nothing to claim.",
    "You have already claimed your rewards.",
    "The game hasn't ended on-chain yet. Wait a few seconds and try again.",
    "The claim window has closed.",
    "No reward is available for this pool.",
    OVERFLOW,
    UNAUTHORIZED,
    MISMATCH,
  ],
  withdraw: [
    "Withdrawals are only possible while the pool is filling or after it was closed.",
    "This pool is not the currently open filling pool.",
    "You have already withdrawn from this pool.",
    OVERFLOW,
    OVERFLOW,
    UNAUTHORIZED,
    MISMATCH,
  ],
  close: [
    "Only a filling pool can be closed.",
    "This pool is not the currently open filling pool.",
    "The fill window is still open — the pool can't be closed yet.",
    "This pool is already empty.",
  ],
  finalize: [
    "This pool has already been finalized.",
    "The game hasn't ended on-chain yet. Wait a few seconds and try again.",
    "The claim window is still open — the pool can't be finalized yet.",
    OVERFLOW,
  ],
  sweep: [
    "Only a closed pool can be swept.",
    "This pool still has players — they need to withdraw first.",
    "The vault is already empty — there is nothing to recover.",
    OVERFLOW,
  ],
  redistribution: [
    "The pool hasn't been finalized yet.",
    "The pool is in an inconsistent state. Please report this.",
    "There is no bonus to collect for this pool.",
    "Only players who claimed during the claim window can collect the bonus.",
    "You have already collected your bonus.",
    UNAUTHORIZED,
    MISMATCH,
  ],
  create: [
    "A pool is already open for filling. Only one filling pool can exist at a time — join that one instead.",
    OVERFLOW,
  ],
};

// Anchor framework errors worth explaining (account validation failures).
const ANCHOR_ERRORS: Record<number, string> = {
  2006: "Account address mismatch. The app may be pointed at the wrong network or program.",
  2012: "Account address mismatch. The app may be pointed at the wrong network or program.",
  2014: "Your token account is for a different token than this pool uses.",
  2015: "Your THEO token account is not owned by this wallet.",
  3007: "An account is owned by an unexpected program. The app may be pointed at the wrong network.",
  3012: "Your wallet has no THEO token account yet. Get some THEO first, then try again.",
};

function extractCustomCode(e: any): number | null {
  // Confirmed-but-failed transactions: { InstructionError: [index, { Custom: code }] }
  const ixErr = e?.InstructionError ?? e?.err?.InstructionError;
  if (Array.isArray(ixErr) && typeof ixErr[1]?.Custom === "number") return ixErr[1].Custom;

  const logs: string[] = e?.logs ?? e?.error?.logs ?? [];
  const text = [e?.message, e?.error?.message, ...logs].filter(Boolean).join("\n");
  const hex = text.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (hex) return parseInt(hex[1], 16);
  const json = text.match(/"Custom":\s*(\d+)/);
  if (json) return Number(json[1]);
  return null;
}

export function decodeTxError(e: any, action?: TxAction): string {
  const text = String(e?.message ?? e?.error?.message ?? (typeof e === "string" ? e : "") ?? "");

  if (/user rejected|rejected the request|user denied|cancelled|canceled/i.test(text)) {
    return "Transaction cancelled in your wallet.";
  }
  if (/no record of a prior credit|insufficient lamports|insufficient funds for (fee|rent)/i.test(text)) {
    return "Your wallet doesn't have enough XNT to pay the network fee.";
  }
  if (/failed to fetch|network ?error|429|timed? ?out|ECONNRE/i.test(text) && extractCustomCode(e) === null) {
    return "Couldn't reach the X1 network. Check your connection and try again.";
  }
  if (/blockhash not found|block height exceeded|expired/i.test(text)) {
    return "The transaction expired before it was confirmed. Please try again.";
  }

  const code = extractCustomCode(e);
  if (code !== null) {
    if (code >= 6000 && action) {
      const msg = PROGRAM_ERRORS[action][code - 6000];
      if (msg) return msg;
    }
    if (ANCHOR_ERRORS[code]) return ANCHOR_ERRORS[code];
    // System program: account already in use — the position account from an earlier join still exists.
    if (code === 0 && action === "join") return "This wallet already joined this pool once and can't join it again.";
    if (code === 0 && action === "create") return "That pool was just created by someone else. Refresh and try again.";
    // Token program: insufficient funds.
    if (code === 1) {
      return action === "join"
        ? "You need at least 0.20 THEO in your wallet to join."
        : "The pool vault doesn't hold enough THEO for this payout. Please report this.";
    }
    return `The program rejected the transaction (error code ${code} / 0x${code.toString(16)}).`;
  }

  return text || "Transaction failed.";
}
