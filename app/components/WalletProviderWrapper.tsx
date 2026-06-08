"use client";
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { FC, ReactNode, useMemo } from "react";
// @ts-ignore
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
// @ts-ignore
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_ENDPOINT } from "@/lib/constants";

export const WalletProviderWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(() => [
    new BackpackWalletAdapter(),
  ], []);
  return (
    // @ts-ignore
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      {/* @ts-ignore */}
      <WalletProvider wallets={wallets} autoConnect={false}>
        {/* @ts-ignore */}
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
export default WalletProviderWrapper;
