"use client";
import { EARLY_EXIT_RETURN, STAKE_AMOUNT } from "@/lib/constants";

export function ConfirmExitModal({ open, poolName, onConfirm, onCancel }: { open: boolean; poolName: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-exit-title" onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--danger)", borderRadius: "var(--radius-lg)", padding: 32, maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>⚠️</div>
        <h2 id="confirm-exit-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, textAlign: "center" }}>Exit {poolName} early?</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          Exiting early costs you a <strong style={{ color: "var(--danger)" }}>50% penalty</strong>. This cannot be undone.
        </p>
        <div style={{ display: "grid", gap: 8, padding: 14, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", fontSize: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Your stake</span><span style={{ fontWeight: 700 }}>{STAKE_AMOUNT.toFixed(2)} THEO</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>You get back</span><span style={{ fontWeight: 700 }}>{EARLY_EXIT_RETURN.toFixed(2)} THEO</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Forfeited to survivors</span><span style={{ fontWeight: 700, color: "var(--danger)" }}>{(STAKE_AMOUNT - EARLY_EXIT_RETURN).toFixed(2)} THEO</span></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>You also give up your share of the penalty pot. Staying until the game ends returns your full stake plus that share.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>Stay in pool</button>
          <button className="btn btn-danger" onClick={onConfirm} style={{ flex: 1 }}>Exit &amp; lose 50%</button>
        </div>
      </div>
    </div>
  );
}
