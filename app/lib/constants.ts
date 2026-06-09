import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "8QGfTSEwKvzr8NKLHw2xEigz18KDfdkiFJeM3ALnvbVH"
);

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://rpc.mainnet.x1.xyz";

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "mainnet";
