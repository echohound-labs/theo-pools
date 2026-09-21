import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "8QGfTSEwKvzr8NKLHw2xEigz18KDfdkiFJeM3ALnvbVH"
);

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://rpc.mainnet.x1.xyz";

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "mainnet";

// Mirrors Pool::MAX_PLAYERS in the on-chain program (not stored on the pool account).
export const MAX_PLAYERS = NETWORK === "testnet" ? 5 : 10;

// Stake per player in THEO (Pool::STAKE_AMOUNT = 20 raw units, 2 decimals).
export const STAKE_AMOUNT = 0.20;

// Returned to an early exiter in THEO (Pool::EARLY_EXIT_RETURN).
export const EARLY_EXIT_RETURN = 0.10;

// Seconds to wait past end_time before offering Claim — the browser clock can run ahead of the chain clock.
export const CLAIM_BUFFER_SECS = 5;
