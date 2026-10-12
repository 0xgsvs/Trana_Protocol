import { useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { SolanaCliWalletAdapter } from "./program/cliWalletAdapter";
import { RPC_URL, usdcMint } from "./program/constants";
import { SetupNotice } from "./components/SetupNotice";
import { WalletBar } from "./components/WalletBar";
import { ShipperView } from "./views/ShipperView";
import { LpView } from "./views/LpView";
import { PoolView } from "./views/PoolView";

import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";

type Tab = "pool" | "shipper" | "lp";

interface TabItem {
  id: Tab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const TABS: TabItem[] = [
  {
    id: "pool",
    label: "Pool Overview",
    icon: (active) => (
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke={active ? "currentColor" : "var(--text-muted)"}
        strokeWidth="1.5"
      >
        <rect x="2" y="2" width="5" height="5" rx="1.5" />
        <rect x="9" y="2" width="5" height="5" rx="1.5" />
        <rect x="2" y="9" width="5" height="5" rx="1.5" />
        <rect x="9" y="9" width="5" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "shipper",
    label: "Buy Cover",
    icon: (active) => (
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke={active ? "currentColor" : "var(--text-muted)"}
        strokeWidth="1.5"
      >
        <path d="M8 1.5L2.5 4.5V9C2.5 12.5 8 14.5 8 14.5C8 14.5 13.5 12.5 13.5 9V4.5L8 1.5Z" />
        <path d="M6 8L7.5 9.5L10.5 6.5" />
      </svg>
    ),
  },
  {
    id: "lp",
    label: "Provide Liquidity",
    icon: (active) => (
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke={active ? "currentColor" : "var(--text-muted)"}
        strokeWidth="1.5"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5V11" />
        <path d="M5 8H11" />
      </svg>
    ),
  },
];

export function App() {
  const [tab, setTab] = useState<Tab>("pool");
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new SolanaCliWalletAdapter()],
    [],
  );

  // Config gate: without the USDC mint nothing downstream can work.
  if (!usdcMint()) {
    return <SetupNotice />;
  }

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletBar />

          <section className="nav-section">
            <nav className="tabs-container" aria-label="Navigation Tabs">
              {TABS.map((t) => {
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    className={isActive ? "active" : ""}
                    onClick={() => setTab(t.id)}
                    type="button"
                  >
                    {t.icon(isActive)}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </section>

          <main className="container">
            {tab === "pool" && <PoolView />}
            {tab === "shipper" && <ShipperView />}
            {tab === "lp" && <LpView />}

            <footer className="app-footer">
              <div>
                <span>Trana Protocol · Decentralized Parametric Cargo Insurance on Solana</span>
              </div>
              <div className="footer-links">
                <a
                  href="https://github.com/Trana-Protocol"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <a
                  href="https://explorer.solana.com/?cluster=devnet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solana Devnet
                </a>
                <a href="https://morpho.org" target="_blank" rel="noopener noreferrer">
                  Morpho Design System
                </a>
              </div>
            </footer>
          </main>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
