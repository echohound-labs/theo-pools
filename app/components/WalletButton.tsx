"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function truncate(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  if (connecting) return <button className="btn btn-secondary" disabled><span className="spinner" />Connecting...</button>;
  if (publicKey) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--accent-dim)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
        {truncate(publicKey.toBase58())}
      </span>
      <button className="btn btn-secondary" onClick={disconnect} style={{ padding: "6px 12px", fontSize: 13 }}>Disconnect</button>
    </div>
  );
  return <button className="btn btn-primary" onClick={() => setVisible(true)} style={{ padding: "8px 20px" }}>Connect Wallet</button>;
}
