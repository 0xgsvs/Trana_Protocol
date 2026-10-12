import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useFreightDelay } from "../program/useProgram";
import { shortAddress } from "../lib/format";

export function WalletBar() {
  const { publicKey, configPda } = useFreightDelay();

  const explorerUrl = configPda
    ? `https://explorer.solana.com/address/${configPda.toBase58()}?cluster=devnet`
    : null;

  return (
    <header className="wallet-bar">
      <div className="brand-container">
        <a href="/" className="brand-logo-link">
          <span className="brand-icon" aria-hidden="true">
            {/* Morpho-inspired geometric icon for Trana */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M4 6.5L14 3L24 6.5V14.5C24 20.5 14 25.5 14 25.5C14 25.5 4 20.5 4 14.5V6.5Z"
                stroke="rgba(36, 112, 255, 0.4)"
                strokeWidth="1.5"
                fill="rgba(36, 112, 255, 0.08)"
              />
              <path
                d="M7 9.5L14 7L21 9.5V14C21 18.5 14 22.5 14 22.5C14 22.5 7 18.5 7 14V9.5Z"
                fill="url(#trana-grad)"
              />
              <path d="M14 7V22.5" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" />
              <defs>
                <linearGradient
                  id="trana-grad"
                  x1="7"
                  y1="7"
                  x2="21"
                  y2="22.5"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#5792FF" />
                  <stop offset="1" stopColor="#1a5fe0" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <div className="brand-title">
            <span className="brand-name">TRANA</span>
            <span className="brand-subtitle">PROTOCOL</span>
          </div>
        </a>

        <div className="header-chips">
          <div className="chip chip-network">
            <span className="chip-pulse-dot" />
            <span>Devnet</span>
          </div>

          {configPda && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chip mono"
              title="View Pool Config PDA on Solana Explorer"
            >
              <span>Pool</span>
              <span>{shortAddress(configPda)}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3.5 1.5H10.5V8.5" />
                <path d="M10.5 1.5L1.5 10.5" />
              </svg>
            </a>
          )}
        </div>
      </div>

      <div className="wallet-bar-right">
        {publicKey && (
          <div className="wallet-user-chip mono">
            <span className="wallet-user-dot" />
            <span>{shortAddress(publicKey)}</span>
          </div>
        )}
        <WalletMultiButton />
      </div>
    </header>
  );
}
