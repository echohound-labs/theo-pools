import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID, RPC_ENDPOINT, MAX_PLAYERS, STAKE_AMOUNT } from "./constants";
import { Pool, UserPosition } from "./types";
import IDL from "./idl.json";

const THEO_MINT = new PublicKey("5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS");
const DECIMALS = 100;

// ── Connection & Program ─────────────────────────────────────────
export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

function getReadonlyProgram(): Program {
  const connection = getConnection();
  
  const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
  return new Program(IDL as any, provider);
}

// ── PDAs ─────────────────────────────────────────────────────────
function poolIdBytes(id: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return buf;
}

const PDAs = {
  globalState:   () => PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM_ID)[0],
  rolloverVault: () => PublicKey.findProgramAddressSync([Buffer.from("rollover_vault")], PROGRAM_ID)[0],
  pool:          (id: number) => PublicKey.findProgramAddressSync([Buffer.from("pool"), poolIdBytes(id)], PROGRAM_ID)[0],
  vault:         (id: number) => PublicKey.findProgramAddressSync([Buffer.from("vault"), poolIdBytes(id)], PROGRAM_ID)[0],
  position:      (poolId: number, player: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("position"), poolIdBytes(poolId), player.toBuffer()], PROGRAM_ID)[0],
};

async function ata(player: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(THEO_MINT, player, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

async function makeTx(player: PublicKey, ix: any): Promise<Transaction> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: player });
  tx.add(ix);
  return tx;
}

// ── Data Fetching ────────────────────────────────────────────────
function statusToString(status: any): Pool["status"] {
  if (status.filling !== undefined) return "Filling";
  if (status.active !== undefined) return "Active";
  if (status.claiming !== undefined) return "Claiming";
  if (status.finalized !== undefined) return "Finalized";
  return "Closed";
}

function mapPoolAccount(account: any, poolId: number): Pool {
  const status = statusToString(account.status);
  const playerCount = account.playerCount ?? 0;
  const survivorCount = account.survivorCount ?? 0;
  const endTime = account.endTime?.toNumber() ?? 0;
  const penaltyRaw = account.penaltyVaultBalance?.toNumber() ?? 0;
  // Survivor return on stake so far: penalty pot share / stake (STAKE_AMOUNT = 20 raw units).
  const returnPct = survivorCount > 0
    ? (penaltyRaw / (survivorCount * 20)) * 100
    : 0;
  return {
    id: String(poolId),
    name: `Pool #${poolId}`,
    description: status === "Active"
      ? `Active — ${survivorCount} survivors. Game ends ${new Date(endTime * 1000).toLocaleDateString()}.`
      : status === "Filling"
      ? `Filling — ${playerCount}/${MAX_PLAYERS} players. Stake 0.20 THEO to enter.`
      : status === "Claiming"
      ? `Claim window open! Survivors can claim rewards.`
      : `Pool ${status.toLowerCase()}.`,
    tvl: (penaltyRaw + survivorCount * 20) / DECIMALS,
    returnPct,
    minStake: 0.20,
    maxPlayers: MAX_PLAYERS,
    maxStake: 1000,
    playerCount,
    survivorCount,
    penaltyVaultBalance: penaltyRaw / DECIMALS,
    isActive: ["Active", "Filling", "Claiming"].includes(status),
    status,
    createdAt: account.startTime?.toNumber() ?? 0,
    startTime: account.startTime?.toNumber() ?? 0,
    endTime,
    claimDeadline: account.claimDeadline?.toNumber() ?? 0,
    rewardPerSurvivor: (account.rewardPerSurvivor?.toNumber() ?? 0) / DECIMALS,
    stakeMint: THEO_MINT.toBase58(),
    fillDeadline: account.fillDeadline?.toNumber() ?? 0,
    claimedCount: account.claimedCount ?? 0,
  };
}

export async function getAllPools(includeEnded = false): Promise<Pool[]> {
  try {
    const program = getReadonlyProgram();
    const globalState = await (program.account as any).globalState.fetch(PDAs.globalState());
    const poolCount = globalState.poolCount?.toNumber() ?? 0;
    const pools: Pool[] = [];
    for (let i = 0; i < poolCount; i++) {
      try {
        const account = await (program.account as any).pool.fetch(PDAs.pool(i));
        const pool = mapPoolAccount(account, i);
        if ((includeEnded || !["Closed", "Finalized"].includes(pool.status)) && i !== 0 && i !== 5) pools.push(pool);
      } catch { }
    }
    return pools;
  } catch (e) {
    console.error("getAllPools error:", e);
    return [];
  }
}

/**
 * Returns null only when the pool account does not exist.
 * Network / RPC failures throw, so callers can tell "not found" apart from "couldn't load".
 */
export async function getPoolState(poolId: string): Promise<Pool | null> {
  const id = Number(poolId);
  if (!Number.isSafeInteger(id) || id < 0) return null;
  const program = getReadonlyProgram();
  const account = await (program.account as any).pool.fetchNullable(PDAs.pool(id));
  if (!account) return null;
  const pool = mapPoolAccount(account, id);
  if (pool.status === "Closed" && pool.playerCount === 0) {
    try {
      const bal = await getConnection().getTokenAccountBalance(PDAs.vault(id));
      pool.vaultBalance = Number(bal.value.amount) / DECIMALS;
    } catch (e) {
      console.error("vault balance fetch failed:", e);
    }
  }
  return pool;
}

function mapPosition(pos: any, poolAcc: any, poolId: number): UserPosition {
  const pool = mapPoolAccount(poolAcc, poolId);
  // Penalty share is only frozen on-chain once the pool enters Claiming; estimate floor(P / W) before that.
  const penaltyRaw = poolAcc.penaltyVaultBalance?.toNumber() ?? 0;
  const rewardRaw = poolAcc.rewardPerSurvivor?.toNumber() ?? 0;
  const shareRaw = pool.status === "Active" && pool.survivorCount > 0 ? Math.floor(penaltyRaw / pool.survivorCount) : rewardRaw;
  return {
    poolId: String(poolId),
    poolName: pool.name,
    stakedAmount: (pos.amount?.toNumber() ?? 0) / DECIMALS,
    // Full claim payout: stake + penalty share.
    claimableRewards: STAKE_AMOUNT + shareRaw / DECIMALS,
    entryTimestamp: pos.depositedAt?.toNumber() ?? 0,
    exitedEarly: pos.exitedEarly ?? false,
    claimed: pos.claimed ?? false,
    withdrewFilling: pos.withdrewFilling ?? false,
    redistributionCollected: pos.redistributionCollected ?? false,
    lockupEnds: pool.endTime,
    claimDeadline: pool.claimDeadline,
    redistributionPerClaimer: (poolAcc.redistributionPerClaimer?.toNumber() ?? 0) / DECIMALS,
    poolStatus: pool.status,
    poolTvl: pool.tvl,
    penaltyPot: pool.penaltyVaultBalance,
  };
}

/**
 * Single position lookup. Returns null only when the wallet never joined the pool;
 * positions withdrawn during Filling are returned with withdrewFilling = true
 * (the account still exists, so that wallet can't rejoin). Network failures throw.
 */
export async function getUserPosition(poolId: string, wallet: PublicKey): Promise<UserPosition | null> {
  const id = Number(poolId);
  const program = getReadonlyProgram();
  const pos = await (program.account as any).userPosition.fetchNullable(PDAs.position(id, wallet));
  if (!pos) return null;
  const poolAcc = await (program.account as any).pool.fetch(PDAs.pool(id));
  return mapPosition(pos, poolAcc, id);
}

export async function getUserPositions(wallet: PublicKey): Promise<UserPosition[]> {
  try {
    const program = getReadonlyProgram();
    const globalState = await (program.account as any).globalState.fetch(PDAs.globalState());
    const poolCount = globalState.poolCount?.toNumber() ?? 0;
    const positions: UserPosition[] = [];
    for (let i = 0; i < poolCount; i++) {
      try {
        const pos = await (program.account as any).userPosition.fetchNullable(PDAs.position(i, wallet));
        if (pos && !pos.withdrewFilling) {
          const poolAcc = await (program.account as any).pool.fetch(PDAs.pool(i));
          positions.push(mapPosition(pos, poolAcc, i));
        }
      } catch (e) {
        console.error(`getUserPositions: pool ${i} failed`, e);
      }
    }
    return positions;
  } catch (e) {
    console.error("getUserPositions error:", e);
    return [];
  }
}

// ── Transaction Builders ─────────────────────────────────────────
export async function joinPool(poolId: string, amount: number, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).deposit().accounts({
    player: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(id),
    userPosition: PDAs.position(id, wallet),
    tokenMint: THEO_MINT,
    playerTokenAccount: await ata(wallet),
    poolVault: PDAs.vault(id),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function exitPool(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).earlyExit().accounts({
    player: wallet,
    pool: PDAs.pool(id),
    userPosition: PDAs.position(id, wallet),
    tokenMint: THEO_MINT,
    playerTokenAccount: await ata(wallet),
    poolVault: PDAs.vault(id),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function claimRewards(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).claim().accounts({
    player: wallet,
    pool: PDAs.pool(id),
    userPosition: PDAs.position(id, wallet),
    tokenMint: THEO_MINT,
    playerTokenAccount: await ata(wallet),
    poolVault: PDAs.vault(id),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function createPool(wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const globalState = await (program.account as any).globalState.fetch(PDAs.globalState());
  const poolId = Number(globalState.poolCount);
  const ix = await (program.methods as any).createPool().accounts({
    creator: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(poolId),
    tokenMint: THEO_MINT,
    rolloverVault: PDAs.rolloverVault(),
    poolVault: PDAs.vault(poolId),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function finalize(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).finalize().accounts({
    caller: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(id),
    tokenMint: THEO_MINT,
    poolVault: PDAs.vault(id),
    rolloverVault: PDAs.rolloverVault(),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function withdraw(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).withdraw().accounts({
    player: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(id),
    userPosition: PDAs.position(id, wallet),
    tokenMint: THEO_MINT,
    playerTokenAccount: await ata(wallet),
    poolVault: PDAs.vault(id),
    rolloverVault: PDAs.rolloverVault(),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function closeStalledPool(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).closeStalledPool().accounts({
    caller: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(id),
    systemProgram: SystemProgram.programId,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function sweepEmptyVault(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).sweepEmptyVault().accounts({
    caller: wallet,
    globalState: PDAs.globalState(),
    pool: PDAs.pool(id),
    tokenMint: THEO_MINT,
    poolVault: PDAs.vault(id),
    rolloverVault: PDAs.rolloverVault(),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function collectRedistribution(poolId: string, wallet: PublicKey): Promise<Transaction> {
  const program = getReadonlyProgram();
  const id = Number(poolId);
  const ix = await (program.methods as any).collectRedistribution().accounts({
    player: wallet,
    pool: PDAs.pool(id),
    userPosition: PDAs.position(id, wallet),
    tokenMint: THEO_MINT,
    playerTokenAccount: await ata(wallet),
    poolVault: PDAs.vault(id),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();
  return makeTx(wallet, ix);
}

export async function getRolloverBalance(): Promise<number> {
  try {
    const program = getReadonlyProgram();
    const gs = await (program.account as any).globalState.fetch(PDAs.globalState());
    return (gs.rolloverBalance?.toNumber() ?? 0) / DECIMALS;
  } catch {
    return 0;
  }
}

export async function getNextPoolId(): Promise<number> {
  try {
    const program = getReadonlyProgram();
    const gs = await (program.account as any).globalState.fetch(PDAs.globalState());
    return gs.poolCount?.toNumber() ?? 0;
  } catch {
    return 0;
  }
}
