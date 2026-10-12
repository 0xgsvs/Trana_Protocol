import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  ataAddress,
  depositCapital,
  fetchLpPosition,
  fetchPoolConfig,
  maybeCreateAtaIx,
  withdrawCapital,
} from "../program/client";
import { lpPositionPda } from "../program/pdas";
import { useFreightDelay } from "../program/useProgram";
import type { LpPosition, PoolConfig } from "../program/types";
import { positionValue } from "../program/types";
import { baseToUi, uiToBase } from "../lib/amounts";

export function LpView() {
  const { program, isWalletConnected, publicKey, configPda, treasuryPda, mint } = useFreightDelay();
  const { connection } = useConnection();

  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [position, setPosition] = useState<LpPosition | null>(null);
  const [depositAmount, setDepositAmount] = useState("1000");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!configPda) return;
    setIsRefreshing(true);
    try {
      const fetches: [Promise<PoolConfig | null>, Promise<LpPosition | null>] = [
        fetchPoolConfig(program, configPda),
        publicKey
          ? fetchLpPosition(program, lpPositionPda(configPda, publicKey)[0])
          : Promise.resolve(null),
      ];
      const [cfg, pos] = await Promise.all(fetches);
      setConfig(cfg);
      setPosition(pos);
    } catch (err) {
      setStatus(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [program, publicKey, configPda]);

  useEffect(() => {
    // Intentional: initial chain-state fetch on mount / wallet change.
    // oxlint-disable-next-line react/set-state-in-effect
    refresh();
  }, [refresh]);

  async function onDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!program || !publicKey || !mint || !configPda || !treasuryPda) {
      setStatus("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setTxSignature(null);
    try {
      const [lpPosition] = lpPositionPda(configPda, publicKey);
      const lpAta = await ataAddress(mint, publicKey);
      const createIx = await maybeCreateAtaIx(connection, publicKey, publicKey, mint);
      if (createIx) {
        setStatus("Creating your USDC associated token account first...");
      }
      const sig = await depositCapital(
        program,
        {
          lp: publicKey,
          config: configPda,
          usdcMint: mint,
          treasury: treasuryPda,
          lpPosition,
          lpAta,
          amount: uiToBase(depositAmount),
        },
        createIx ? [createIx] : [],
      );
      setTxSignature(sig);
      setStatus(`Successfully deposited ${depositAmount} USDC!`);
      await refresh();
    } catch (err) {
      setStatus(`Deposit failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!program || !publicKey || !mint || !configPda || !treasuryPda) {
      setStatus("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setTxSignature(null);
    try {
      const [lpPosition] = lpPositionPda(configPda, publicKey);
      const lpAta = await ataAddress(mint, publicKey);
      const sig = await withdrawCapital(program, {
        lp: publicKey,
        config: configPda,
        usdcMint: mint,
        treasury: treasuryPda,
        lpPosition,
        lpAta,
        shares: BigInt(withdrawShares),
      });
      setTxSignature(sig);
      setStatus(`Successfully redeemed ${withdrawShares} shares!`);
      setWithdrawShares("");
      await refresh();
    } catch (err) {
      setStatus(`Withdrawal failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="hero-header">
        <div className="hero-tag">Liquidity Vault</div>
        <h1 className="hero-title">Provide Capital to the Pool</h1>
        <p className="hero-subtitle">
          Deposit USDC to underwrite parametric delay coverage. Earn automated yield from shipper
          premiums proportional to your share of the underwriting pool.
        </p>
      </div>

      {/* User Position Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Your Liquidity Position</span>
          </h2>
          <button
            className="secondary small"
            onClick={refresh}
            disabled={isRefreshing}
            type="button"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: isRefreshing ? "rotate(180deg)" : "none",
                transition: "transform 0.4s ease",
              }}
            >
              <path d="M14 8A6 6 0 1 1 12.24 3.76L14 2V6H10" />
            </svg>
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {position && config ? (
          <div className="stats-hero-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat-box">
              <div className="stat-label">Shares Owned</div>
              <p className="stat-value mono">{position.shares.toString()}</p>
              <div className="stat-subtext">ERC-4626 style vault shares</div>
            </div>

            <div className="stat-box">
              <div className="stat-label">Pro-Rata Value</div>
              <p className="stat-value" style={{ color: "var(--cyan)" }}>
                <span>{baseToUi(positionValue(config, position))}</span>
                <span className="stat-token">USDC</span>
              </p>
              <div className="stat-subtext">Estimated redeemable capital</div>
            </div>

            <div className="stat-box">
              <div className="stat-label">Pool Share</div>
              <p className="stat-value" style={{ color: "var(--good)" }}>
                {config.totalShares === 0n
                  ? "0.00%"
                  : `${(Number((position.shares * 10000n) / config.totalShares) / 100).toFixed(2)}%`}
              </p>
              <div className="stat-subtext">
                {config.totalShares === 0n
                  ? "—"
                  : `${((position.shares * 10000n) / config.totalShares).toString()} bps`}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              {!isWalletConnected
                ? "Connect your wallet above to view your liquidity position and rewards."
                : "No active liquidity position found for this wallet. Deposit below to begin earning yield."}
            </p>
          </div>
        )}
      </div>

      {/* Deposit and Withdraw Action Grid */}
      <div className="grid2">
        {/* Deposit Card */}
        <form onSubmit={onDeposit} className="card form">
          <h2 className="card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Deposit Capital</span>
          </h2>
          <p className="muted fine" style={{ margin: "-8px 0 0" }}>
            Add USDC to the pool. You will receive pro-rata pool shares representing your claim on
            capital and earned underwriting fees.
          </p>

          <div className="form-field">
            <label className="form-label">
              <span>Deposit Amount</span>
              <span className="fine muted">USDC</span>
            </label>
            <div className="input-wrapper">
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="1000"
                required
              />
              <span className="input-suffix">USDC</span>
            </div>
            <div className="chip-group">
              {["500", "1000", "5000", "10000"].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="preset-chip mono"
                  onClick={() => setDepositAmount(amt)}
                >
                  ${Number(amt).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-block" disabled={busy || !isWalletConnected}>
            {!isWalletConnected
              ? "Connect Wallet to Deposit"
              : busy
                ? "Confirming Deposit..."
                : "Deposit USDC"}
          </button>
        </form>

        {/* Withdraw Card */}
        <form onSubmit={onWithdraw} className="card form">
          <h2 className="card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Withdraw Liquidity</span>
          </h2>
          <p className="muted fine" style={{ margin: "-8px 0 0" }}>
            Burn shares to redeem your principal plus any accumulated underwriting yield.
            Withdrawals depend on available unreserved pool capital.
          </p>

          <div className="form-field">
            <label className="form-label">
              <span>Shares to Redeem</span>
              {position && (
                <button
                  type="button"
                  className="linklike mono"
                  onClick={() => setWithdrawShares(position.shares.toString())}
                >
                  Max ({position.shares.toString()})
                </button>
              )}
            </label>
            <div className="input-wrapper">
              <input
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder={position ? position.shares.toString() : "0"}
                required
              />
              <span className="input-suffix">Shares</span>
            </div>
          </div>

          <button
            type="submit"
            className="secondary btn-block"
            disabled={busy || !isWalletConnected || !position || position.shares === 0n}
          >
            {!isWalletConnected
              ? "Connect Wallet to Withdraw"
              : busy
                ? "Processing Withdrawal..."
                : "Withdraw Capital"}
          </button>
        </form>
      </div>

      {/* Transaction Alert / Status Feedback */}
      {status && (
        <div className="status" role="status">
          <svg
            className="status-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div style={{ flex: 1 }}>
            <span>{status}</span>
            {txSignature && (
              <div style={{ marginTop: 4 }}>
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono fine"
                >
                  View Transaction on Solana Explorer →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
