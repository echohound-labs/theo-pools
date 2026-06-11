"use client";

import "./globals.css";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { Navbar } from "@/components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>THEO Pools — X1 Staking</title>
        <meta
          name="description"
          content="Stake THEO tokens, survive the full duration, and split the penalty pot with other survivors."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <WalletProviderWrapper>
          <Navbar />
          <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
            {children}
          </main>
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
