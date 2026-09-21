import { CLAIM_BUFFER_SECS } from "./constants";
import { UserPosition } from "./types";

export type PositionState =
  | "withdrawn"     // withdrew during Filling
  | "exited"        // early exit, 50% returned
  | "claimed"
  | "forfeited"     // survived but never claimed; stake + reward rolled over
  | "withdrawable"  // pool was closed while filling — full refund available
  | "filling"
  | "claimable"
  | "ended"         // game over on the local clock, claim opens after a short buffer
  | "active";

/** Single source of truth for what a position can do right now. `now` is unix seconds. */
export function getPositionState(p: UserPosition, now: number): PositionState {
  if (p.withdrewFilling) return "withdrawn";
  if (p.exitedEarly) return "exited";
  if (p.claimed) return "claimed";
  if (p.poolStatus === "Closed") return "withdrawable";
  if (p.poolStatus === "Filling") return "filling";
  if (p.poolStatus === "Finalized") return "forfeited";
  // Active or Claiming. A pool stays "Active" on-chain until the first claim/finalize, so go by time.
  const end = p.lockupEnds ?? 0;
  if (end === 0 || now < end) return "active";
  if (p.claimDeadline > 0 && now > p.claimDeadline) return "forfeited";
  return now >= end + CLAIM_BUFFER_SECS ? "claimable" : "ended";
}
