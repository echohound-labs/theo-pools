"use client";
import { useState } from "react";
import Link from "next/link";
import { Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { exitPool, claimRewards, collectRedistribution } from "@/lib/instructions";
import { ConfirmExitModal } from "@/components/ConfirmExitModal";
import { EARLY_EXIT_RETURN } from "@/lib/constants";
import { TxAction } from "@/lib/errors";
import { sendAndConfirm } from "@/lib/tx";
import { getPositionState } from "@/lib/positionState";
import { UserPosition } from "@/lib/types";

interface StakePositionProps {
  position: UserPosition;
  onRefresh?: () => void;
}

export function StakePosition({ position, onRefresh }: StakePositionProps) {
  const [pending, setPending] = useState<TxAction | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const now = Math.floor(Date.now() / 1000);
  const state = getPositionState(position, now);
  const gameEnded = position.lockupEnds ? now >= position.lockupEnds : false;
  const rolledOver = state === "forfeited";
  // Early exit only exists during the Active lock; Filling/Closed positions withdraw in full from the pool page.
  const canExit = state === "active" && position.poolStatus === "Active";
  const canClaim = state === "claimable";
  const canWithdraw = state === "filling" || state === "withdrawable";
  const canCollect = state === "claimed" && !position.redistributionCollected && position.redistributionPerClaimer > 0 && position.poolStatus === "Finalized";
  const busy = pending !== null;
  const exiting = pending === "exit", claiming = pending === "claim", collecting = pending === "redistribution";

  async function run(action: TxAction, build: () => Promise<Transaction>, successText: string) {
    if (!publicKey || busy) return;
    setPending(action);
    setMessage(null);
    try {
      await sendAndConfirm(await build(), sendTransaction, connection, action);
      setMessage({ type: "success", text: successText });
      onRefresh?.();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Transaction failed" });
    } finally {
      setPending(null);
    }
  }

  const handleExit = () => run("exit", () => exitPool(position.poolId, publicKey!), `Exited early — ${EARLY_EXIT_RETURN.toFixed(2)} THEO returned, the rest went to survivors.`);
  const handleCollect = () => run("redistribution", () => collectRedistribution(position.poolId, publicKey!), `Collected ${position.redistributionPerClaimer.toFixed(2)} THEO redistribution bonus!`);
  const handleClaim = () => run("claim", () => claimRewards(position.poolId, publicKey!), `Claimed ${position.claimableRewards.toFixed(2)} THEO (stake + reward)!`);

  // Status badge
  const badge = state === "claimed"
    ? { label: "✓ Claimed", color: "var(--success)", bg: "rgba(46,204,113,0.1)", border: "rgba(46,204,113,0.3)" }
    : state === "exited"
    ? { label: "Exited Early", color: "var(--danger)", bg: "rgba(231,76,60,0.1)", border: "rgba(231,76,60,0.3)" }
    : rolledOver
    ? { label: "🔄 Rolled Over", color: "var(--text-muted)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" }
    : state === "withdrawable"
    ? { label: "↩️ Withdrawable", color: "var(--accent)", bg: "rgba(252,163,17,0.1)", border: "rgba(252,163,17,0.3)" }
    : state === "filling"
    ? { label: "⏳ Filling", color: "var(--accent)", bg: "rgba(252,163,17,0.1)", border: "rgba(252,163,17,0.3)" }
    : state === "claimable" || state === "ended"
    ? { label: "🏆 Survivor! Claim Now!", color: "var(--success)", bg: "rgba(46,204,113,0.1)", border: "rgba(46,204,113,0.3)" }
    : { label: "🟡 Active", color: "var(--accent)", bg: "rgba(252,163,17,0.1)", border: "rgba(252,163,17,0.3)" };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}><Link href={`/pool/${position.poolId}`}>{position.poolName}</Link></h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Joined {new Date(position.entryTimestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <span style={{ padding: "4px 10px", background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 20, fontSize: 11, color: badge.color, fontWeight: 700 }}>{badge.label}</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <StatBox label={state === "exited" ? "Returned" : "Staked"} value={state === "exited" ? EARLY_EXIT_RETURN.toFixed(2) : state === "claimed" || rolledOver ? "—" : position.stakedAmount.toFixed(2)} unit={state === "claimed" || rolledOver ? "" : "THEO"} />
        {!rolledOver && !position.exitedEarly && (
          <>
            <StatBox label="Penalty Pot" value={position.penaltyPot.toFixed(2)} unit="THEO" />
            <StatBox label="Claimable" value={canClaim || state === "ended" || state === "active" ? `${state === "active" ? "~" : ""}${position.claimableRewards.toFixed(2)}` : canCollect ? position.redistributionPerClaimer.toFixed(2) : "—"} unit={canClaim || canCollect || state === "ended" || state === "active" ? "THEO" : ""} accent />
          </>
        )}
        {rolledOver && (
          <div style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", gridColumn: "span 1" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Status</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Seeded next pool</div>
          </div>
        )}
        <StatBox label={gameEnded ? "Game Ended" : "Game Ends"} value={position.lockupEnds ? new Date(position.lockupEnds * 1000).toLocaleDateString() : "—"} unit="" />
      </div>

      {/* Rolled over explanation */}
      {rolledOver && (
        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          ℹ️ The claim window closed. Your rewards rolled over to seed the next pool. This is how the game works — attention is rewarded.
        </div>
      )}

      {/* Message */}
      {message && (
        <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 12, background: message.type === "success" ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)", border: `1px solid ${message.type === "success" ? "rgba(46,204,113,0.3)" : "rgba(231,76,60,0.3)"}`, color: message.type === "success" ? "var(--success)" : "var(--danger)" }}>
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {canExit && (
          <button className="btn btn-danger" onClick={() => setConfirmExit(true)} disabled={busy} style={{ flex: 1, fontSize: 13 }}>
            {exiting ? <><span className="spinner" /> Exiting…</> : "⚡ Exit Early (50% back)"}
          </button>
        )}
        {canClaim && (
          <button className="btn btn-primary" onClick={handleClaim} disabled={busy} style={{ flex: 1, fontSize: 13 }}>
            {claiming ? <><span className="spinner" /> Claiming…</> : "🏆 Claim Rewards"}
          </button>
        )}
        {canCollect && (
          <button className="btn btn-primary" onClick={handleCollect} disabled={busy} style={{ flex: 1, fontSize: 13 }}>
            {collecting ? <><span className="spinner" /> Collecting…</> : `🎁 Collect ${position.redistributionPerClaimer.toFixed(2)} THEO bonus`}
          </button>
        )}
        {canWithdraw && (
          <Link href={`/pool/${position.poolId}`} className="btn btn-secondary" style={{ flex: 1, fontSize: 13, textAlign: "center" }}>
            {state === "withdrawable" ? "↩️ Pool closed — withdraw your full stake →" : "↩️ Manage on pool page (withdraw is free while filling) →"}
          </Link>
        )}
        {position.claimed && (
          <div style={{ flex: 1, textAlign: "center", padding: "10px", color: "var(--success)", fontSize: 13, fontWeight: 600 }}>✓ Rewards successfully claimed!</div>
        )}
        {position.exitedEarly && (
          <div style={{ flex: 1, textAlign: "center", padding: "10px", color: "var(--text-muted)", fontSize: 13 }}>Exited early — 50% was returned to your wallet</div>
        )}
      </div>

      <ConfirmExitModal
        open={confirmExit && canExit}
        poolName={position.poolName}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => { setConfirmExit(false); handleExit(); }}
      />
    </div>
  );
}

function StatBox({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean; }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>{unit}</span>
      </div>
    </div>
  );
}
