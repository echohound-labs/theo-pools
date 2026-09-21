export type PoolStatus = "Filling" | "Active" | "Claiming" | "Finalized" | "Closed";

export interface Pool {
  id: string;          // numeric pool id as string e.g. "3"
  name: string;
  description: string;
  tvl: number;         // raw units / 100 for display
  returnPct: number;   // survivor return on stake so far, in %
  minStake: number;
  maxPlayers: number;
  maxStake: number;
  playerCount: number;
  survivorCount: number;
  penaltyVaultBalance: number;
  isActive: boolean;
  status: PoolStatus;
  createdAt: number;
  startTime: number;
  endTime: number;
  claimDeadline: number;
  fillDeadline: number;
  rewardPerSurvivor: number;
  claimedCount: number;
  vaultBalance?: number; // only fetched for Closed pools with no players
  poolAuthority?: string;
  stakeMint?: string;
}

export interface UserPosition {
  poolId: string;
  poolName: string;
  stakedAmount: number;
  claimableRewards: number;
  entryTimestamp: number;
  exitedEarly: boolean;
  claimed: boolean;
  withdrewFilling: boolean;
  redistributionCollected: boolean;
  poolTvl: number;
  penaltyPot: number;
  redistributionPerClaimer: number;
  poolStatus: string;
  lockupEnds?: number;
  claimDeadline: number;
}

export interface JoinPoolParams {
  poolId: string;
  amount: number;
}
