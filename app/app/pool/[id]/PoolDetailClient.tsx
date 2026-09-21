"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getPoolState, getUserPosition, joinPool, exitPool, claimRewards, withdraw, closeStalledPool, finalize, sweepEmptyVault, collectRedistribution } from "@/lib/instructions";
import { Countdown } from "@/components/Countdown";
import { ConfirmExitModal } from "@/components/ConfirmExitModal";
import { Pool, UserPosition } from "@/lib/types";
import { PROGRAM_ID, STAKE_AMOUNT, EARLY_EXIT_RETURN } from "@/lib/constants";
import { TxAction } from "@/lib/errors";
import { sendAndConfirm } from "@/lib/tx";
import { getPositionState } from "@/lib/positionState";

export default function PoolDetailClient() {
  const params = useParams();
  const poolId = params.id as string;
  const [pool, setPool] = useState<Pool | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; sig?: string } | null>(null);
  const [successSig, setSuccessSig] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const walletRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!poolId) return;
    const walletKey = publicKey?.toBase58() ?? null;
    walletRef.current = walletKey;
    try {
      const poolData = await getPoolState(poolId);
      const pos = publicKey && poolData ? await getUserPosition(poolId, publicKey) : null;
      // Wallet changed while loading — a newer fetch owns the state now.
      if (walletRef.current !== walletKey) return;
      setPool(poolData);
      setPosition(pos);
      setLoadError(false);
    } catch (e) {
      // Network/RPC failure: keep whatever is already on screen instead of pretending the pool is gone.
      console.error("pool fetch failed:", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [poolId, publicKey]);

  // Drop the previous wallet's position immediately on disconnect / wallet switch.
  useEffect(() => { setPosition(null); }, [publicKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll every 30 seconds to keep pool status fresh
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Keep time-based button visibility current between polls
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(action: TxAction, fn: () => Promise<Transaction>) {
    if (!publicKey) { setVisible(true); return; }
    if (actionLoading) return;
    setActionLoading(action);
    setMessage(null);
    try {
      const tx = await fn();
      const sig = await sendAndConfirm(tx, sendTransaction, connection, action);
      setMessage({ type: "success", text: "✅ Transaction confirmed!", sig });
      setSuccessSig(sig);
      await new Promise(r => setTimeout(r, 2000));
      await fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: `❌ ${e?.message || "Transaction failed"}`, sig: e?.sig });
      fetchData();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-muted)" }}><div className="spinner" style={{ margin: "0 auto 12px", width: 28, height: 28 }} /><p>Loading pool…</p></div>;
  if (!pool && loadError) return <div style={{ textAlign: "center", padding: "100px 0" }}><div style={{ fontSize: 40, marginBottom: 16 }}>📡</div><h2>Couldn&apos;t Load Pool</h2><p style={{ color: "var(--text-secondary)", marginTop: 8 }}>The X1 network didn&apos;t respond. Your funds are not affected.</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setLoading(true); fetchData(); }}>↻ Retry</button></div>;
  if (!pool) return <div style={{ textAlign: "center", padding: "100px 0" }}><div style={{ fontSize: 40, marginBottom: 16 }}>🕳️</div><h2>Pool Not Found</h2><Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>← Back</Link></div>;

  const gameEnded = pool.endTime > 0 && now >= pool.endTime;
  const claimWindowClosed = pool.claimDeadline > 0 && now > pool.claimDeadline;
  const fillDeadlinePassed = pool.fillDeadline > 0 && now > pool.fillDeadline;

  // A position withdrawn during Filling still exists on-chain (so the wallet can't rejoin) but holds nothing.
  const posState = position ? getPositionState(position, now) : null;
  const hasPosition = !!position && posState !== "withdrawn";
  const busy = actionLoading !== null;

  const canJoin = pool.status === "Filling" && !position && !fillDeadlinePassed;
  const canExit = posState === "active" && pool.status === "Active";
  const canClaim = posState === "claimable";
  const canWithdraw = posState === "filling" || posState === "withdrawable";
  const canClose = pool.status === "Filling" && fillDeadlinePassed && pool.playerCount > 0;
  // The pool only leaves "Active" on-chain when someone claims or finalizes, and finalize() accepts an ended Active pool.
  const canFinalize =
    (pool.status === "Claiming" && (claimWindowClosed || pool.claimedCount >= pool.survivorCount)) ||
    (pool.status === "Active" && gameEnded && (claimWindowClosed || pool.survivorCount === 0));
  const canSweep = pool.status === "Closed" && pool.playerCount === 0 && (pool.vaultBalance ?? 0) > 0;
  const bonus = position?.redistributionPerClaimer ?? 0;
  const canCollectRedistribution = posState === "claimed" && !position?.redistributionCollected && pool.status === "Finalized" && bonus > 0;
  const hasAnyAction = canJoin || canExit || canClaim || canWithdraw || canClose || canFinalize || canSweep || canCollectRedistribution;

  const statusLabel: Record<NonNullable<typeof posState>, { text: string; color: string }> = {
    withdrawn: { text: "Withdrawn", color: "var(--text-muted)" },
    exited: { text: "Exited Early", color: "var(--danger)" },
    claimed: { text: "Claimed", color: "var(--success)" },
    forfeited: { text: "Forfeited", color: "var(--danger)" },
    withdrawable: { text: "Withdrawable", color: "var(--accent)" },
    filling: { text: "Waiting for players", color: "var(--accent)" },
    claimable: { text: "Survivor — claim now", color: "var(--success)" },
    ended: { text: "Survivor", color: "var(--success)" },
    active: { text: "Active", color: "var(--accent)" },
  };
  const stakedText =
    posState === "exited" ? `${EARLY_EXIT_RETURN.toFixed(2)} THEO returned` :
    posState === "claimed" ? "Returned" :
    posState === "forfeited" ? "Rolled over" :
    `${(position?.stakedAmount ?? 0).toFixed(2)} THEO`;
  const estimatedClaim = pool.rewardPerSurvivor > 0
    ? STAKE_AMOUNT + pool.rewardPerSurvivor
    : pool.survivorCount > 0 ? STAKE_AMOUNT + Math.floor(pool.penaltyVaultBalance * 100 / pool.survivorCount) / 100 : STAKE_AMOUNT;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/" style={{ color: "var(--text-muted)", fontSize: 14 }}>Pools</Link>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{pool.name}</span>
      </div>

      {loadError && (
        <div style={{ padding: "10px 16px", borderRadius: "var(--radius-sm)", marginBottom: 16, background: "rgba(252,163,17,0.1)", border: "1px solid rgba(252,163,17,0.3)", color: "var(--accent)", fontSize: 13 }}>
          ⚠️ Couldn&apos;t refresh from the X1 network — showing the last loaded data. Retrying automatically.
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 32, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800 }}>{pool.name}</h1>
              <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: pool.status === "Active" ? "rgba(46,204,113,0.15)" : pool.status === "Filling" ? "rgba(252,163,17,0.15)" : "rgba(255,255,255,0.05)", color: pool.status === "Active" ? "var(--success)" : pool.status === "Filling" ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${pool.status === "Active" ? "rgba(46,204,113,0.3)" : pool.status === "Filling" ? "rgba(252,163,17,0.3)" : "rgba(255,255,255,0.1)"}` }}>● {pool.status}</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{pool.description}</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, paddingTop: 24, borderTop: "1px solid var(--border-subtle)", marginBottom: 24 }}>
          {[
            { label: "Players", value: `${pool.playerCount}/${pool.maxPlayers}` },
            { label: "Survivors", value: `${pool.survivorCount}` },
            { label: "Penalty Pot", value: `${pool.penaltyVaultBalance.toFixed(2)} THEO`, accent: true },
            { label: "Reward/Survivor", value: pool.rewardPerSurvivor > 0 ? `${pool.rewardPerSurvivor.toFixed(4)} THEO` : "TBD" },
          ].map(({ label, value, accent }) => (
            <div key={label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
          {pool.status === "Filling" && pool.fillDeadline > 0 && <Countdown targetTime={pool.fillDeadline} label="Fill Window Closes" onComplete={fetchData} />}
          {pool.status === "Active" && pool.endTime > 0 && !gameEnded && <Countdown targetTime={pool.endTime} label="Game Ends In" onComplete={fetchData} />}
          {(pool.status === "Claiming" || (pool.status === "Active" && gameEnded)) && pool.claimDeadline > 0 && <Countdown targetTime={pool.claimDeadline} label="Claim Window Closes" onComplete={fetchData} />}
          {pool.status === "Filling" && pool.fillDeadline === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>⏳ Waiting for first player to start fill timer…</div>}
        </div>
      </div>

      {publicKey && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Your Position</h2>
          {hasPosition ? (
            <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Status</div>
                <div style={{ fontWeight: 700, color: statusLabel[posState!].color }}>{statusLabel[posState!].text}</div>
              </div>
              <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Staked</div>
                <div style={{ fontWeight: 700 }}>{stakedText}</div>
              </div>
              {(pool.status === "Claiming" || pool.status === "Finalized" || gameEnded) && (
              <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Claimable</div>
                <div style={{ fontWeight: 700, color: posState === "forfeited" ? "var(--danger)" : "var(--accent)" }}>
                  {posState === "forfeited" ? "Forfeited — rolled over" :
                   posState === "claimable" || posState === "ended" ? `~${estimatedClaim.toFixed(2)} THEO` :
                   canCollectRedistribution ? `${bonus.toFixed(2)} THEO bonus` :
                   "—"}
                </div>
              </div>
              )}
            </div>
            {posState === "forfeited" && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>The claim window closed before this position was claimed. Its stake and reward rolled over to seed the next pool and can no longer be claimed.</p>
            )}
            {posState === "withdrawable" && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>This pool was closed before it filled. Withdraw to get your full {STAKE_AMOUNT.toFixed(2)} THEO back — no penalty.</p>
            )}
            </>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{posState === "withdrawn" ? "You withdrew from this pool while it was filling. Your stake was returned in full; this wallet can't rejoin this pool." : "You don't have a position in this pool."}</p>
          )}
        </div>
      )}

      {message && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 16, background: message.type === "success" ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)", border: `1px solid ${message.type === "success" ? "rgba(46,204,113,0.3)" : "rgba(231,76,60,0.3)"}`, color: message.type === "success" ? "var(--success)" : "var(--danger)" }}>
          {message.text}
          {message.sig && <a href={`https://explorer.x1.xyz/tx/${message.sig}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", marginLeft: 8, fontSize: 12 }}>View tx ↗</a>}
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Actions</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {!publicKey && <button className="btn btn-primary" onClick={() => setVisible(true)}>Connect Wallet</button>}
          {canJoin && <button className="btn btn-primary" disabled={busy} onClick={() => handleAction("join", () => joinPool(poolId, STAKE_AMOUNT, publicKey!))}>{ actionLoading === "join" ? <><span className="spinner" /> Joining…</> : "💰 Join Pool (0.20 THEO)"}</button>}
          {canExit && (
            <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmExit(true)}>
              {actionLoading === "exit" ? <><span className="spinner" /> Exiting…</> : "⚡ Exit Early (50% back)"}
            </button>
          )}
          {canClaim && (
            <button className="btn btn-primary" disabled={busy} onClick={() => handleAction("claim", () => claimRewards(poolId, publicKey!))}>
              {actionLoading === "claim" ? <><span className="spinner" /> Claiming…</> : "🏆 Claim Rewards"}
            </button>
          )}
          {canWithdraw && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("withdraw", () => withdraw(poolId, publicKey!))}>
              {actionLoading === "withdraw" ? <><span className="spinner" /> Withdrawing…</> : "↩️ Withdraw"}
            </button>
          )}
          {canClose && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("close", () => closeStalledPool(poolId, publicKey!))}>
              {actionLoading === "close" ? <><span className="spinner" /> Closing…</> : "🔓 Close Stalled Pool"}
            </button>
          )}
          {canFinalize && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("finalize", () => finalize(poolId, publicKey!))}>
              {actionLoading === "finalize" ? <><span className="spinner" /> Finalizing…</> : "🏁 Finalize Pool"}
            </button>
          )}
          {canSweep && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("sweep", () => sweepEmptyVault(poolId, publicKey!))}>
              {actionLoading === "sweep" ? <><span className="spinner" /> Sweeping…</> : `🧹 Recover Seed THEO (${(pool.vaultBalance ?? 0).toFixed(2)})`}
            </button>
          )}
          {canCollectRedistribution && (
            <button className="btn btn-primary" disabled={busy} onClick={() => handleAction("redistribution", () => collectRedistribution(poolId, publicKey!))}>
              {actionLoading === "redistribution" ? <><span className="spinner" /> Collecting…</> : `💎 Collect Bonus Rewards (${bonus.toFixed(2)} THEO)`}
            </button>
          )}
          {publicKey && !hasAnyAction && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No actions available for this wallet right now.</p>}
        </div>
        {canSweep && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>Recover Seed THEO moves the leftover seed tokens in this closed pool&apos;s vault into the rollover vault, which seeds the next pool. Nothing is sent to your wallet — you only pay the network fee.</p>
        )}
        {pool.status === "Filling" && fillDeadlinePassed && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>The fill window expired before this pool filled, so it can no longer be joined. Players can withdraw their full stake.</p>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>On-Chain Details</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <DetailRow label="Program ID" value={PROGRAM_ID.toBase58()} mono explorer={`https://explorer.x1.xyz/address/${PROGRAM_ID.toBase58()}`} />
          <DetailRow label="Pool ID" value={pool.id} mono />
          <DetailRow label="Stake Token" value={pool.stakeMint ?? "—"} mono explorer={pool.stakeMint ? `https://explorer.x1.xyz/address/${pool.stakeMint}` : undefined} />
          <DetailRow label="Game End" value={pool.endTime > 0 ? new Date(pool.endTime * 1000).toLocaleString() : "—"} />
          <DetailRow label="Claim Deadline" value={pool.claimDeadline > 0 ? new Date(pool.claimDeadline * 1000).toLocaleString() : "—"} />
        </div>
      </div>

      <ConfirmExitModal
        open={confirmExit && canExit}
        poolName={pool.name}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => { setConfirmExit(false); handleAction("exit", () => exitPool(poolId, publicKey!)); }}
      />

      {successSig && (
        <div onClick={() => setSuccessSig(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--success)", borderRadius: "var(--radius-lg)", padding: 40, textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--success)" }}>Transaction Confirmed!</h2>
            <a href={`https://explorer.x1.xyz/tx/${successSig}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13, display: "block", marginBottom: 24, wordBreak: "break-all" }}>View on Explorer ↗</a>
            <button className="btn btn-primary" onClick={() => setSuccessSig(null)} style={{ width: "100%" }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, explorer }: { label: string; value: string; mono?: boolean; explorer?: string; }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", textAlign: "right" }}>
        {value}{explorer && <a href={explorer} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", marginLeft: 6, fontSize: 11 }}>↗</a>}
      </span>
    </div>
  );
}
