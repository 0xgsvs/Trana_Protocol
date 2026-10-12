import { useCallback, useEffect, useState } from "react";
import {
  ataAddress,
  fetchPoolConfig,
  listPolicies,
  settlePolicy,
  type PolicyWithAddress,
} from "../program/client";
import { deliveryReportPda } from "../program/pdas";
import { useFreightDelay } from "../program/useProgram";
import type { PoolConfig } from "../program/types";
import { baseToUi, formatUnixTs } from "../lib/amounts";
import { freeCapital, policyStatus } from "../program/types";
import { shortAddress } from "../lib/format";

export function PoolView() {
  const { program, publicKey, configPda, mint } = useFreightDelay();

  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [policies, setPolicies] = useState<PolicyWithAddress[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [busyPolicy, setBusyPolicy] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!configPda) return;
    setIsRefreshing(true);
    try {
      const [cfg, pols] = await Promise.all([
        fetchPoolConfig(program, configPda),
        listPolicies(program),
      ]);
      setConfig(cfg);
      setPolicies(pols.sort((a, b) => (a.policy.policyId < b.policy.policyId ? -1 : 1)));
    } catch (err) {
      setStatus(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [program, configPda]);

  useEffect(() => {
    // Intentional: initial chain-state fetch on mount / program change.
    // oxlint-disable-next-line react/set-state-in-effect
    refresh();
  }, [refresh]);

  async function onSettle(entry: PolicyWithAddress) {
    if (!program || !publicKey || !mint || !configPda || !config) return;
    setBusyPolicy(entry.address.toBase58());
    setStatus(null);
    setTxSignature(null);
    try {
      const [deliveryReport] = deliveryReportPda(entry.policy.shipmentId);
      // Payout goes to the insured's USDC account.
      const beneficiaryAta = await ataAddress(mint, entry.policy.insured);
      const sig = await settlePolicy(program, {
        crank: publicKey,
        config: configPda,
        usdcMint: mint,
        treasury: config.treasury,
        policy: entry.address,
        deliveryReport,
        beneficiaryAta,
      });
      setTxSignature(sig);
      setStatus(`Successfully settled policy #${entry.policy.policyId.toString()}`);
      await refresh();
    } catch (err) {
      setStatus(`Settle failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyPolicy(null);
    }
  }

  // Frozen at mount; re-mount keeps it stable by design.
  const [nowSecs] = useState(() => Math.floor(Date.now() / 1000));

  return (
    <section>
      <div className="hero-header">
        <div className="hero-tag">Core Liquidity Pool</div>
        <h1 className="hero-title">Freight Delay Underwriting Pool</h1>
        <p className="hero-subtitle">
          Automated parametric coverage market for maritime supply chains. Backed by institutional
          liquidity and attested port arrival oracles.
        </p>
      </div>

      {config ? (
        <>
          {/* Morpho Hero KPI Grid */}
          <div className="stats-hero-grid">
            <div className="stat-box">
              <div className="stat-label">
                <span>Total Capital</span>
                <span className="mono">TVL</span>
              </div>
              <p className="stat-value">
                <span>{baseToUi(config.totalCapital)}</span>
                <span className="stat-token">USDC</span>
              </p>
              <div className="stat-subtext">Total liquidity deposited by LPs</div>
            </div>

            <div className="stat-box">
              <div className="stat-label">
                <span>Free Capital</span>
                <span style={{ color: "var(--good)" }}>Capacity</span>
              </div>
              <p className="stat-value" style={{ color: "var(--cyan)" }}>
                <span>{baseToUi(freeCapital(config))}</span>
                <span className="stat-token">USDC</span>
              </p>
              <div className="stat-subtext">Available to underwrite new policies</div>
            </div>

            <div className="stat-box">
              <div className="stat-label">
                <span>Locked Risk</span>
                <span style={{ color: "var(--warn)" }}>Active</span>
              </div>
              <p className="stat-value">
                <span>{baseToUi(config.totalLockedRisk)}</span>
                <span className="stat-token">USDC</span>
              </p>
              <div className="stat-subtext">Committed to active cargo shipments</div>
            </div>

            <div className="stat-box">
              <div className="stat-label">
                <span>Protocol Yield</span>
                <span style={{ color: "var(--good)" }}>Earned</span>
              </div>
              <p className="stat-value" style={{ color: "var(--good)" }}>
                <span>{baseToUi(config.totalFees)}</span>
                <span className="stat-token">USDC</span>
              </p>
              <div className="stat-subtext">Cumulative underwriting fees accrued</div>
            </div>
          </div>

          {/* Protocol Parameters Bar */}
          <div className="params-strip" style={{ marginBottom: 24 }}>
            <div className="param-item">
              <span className="param-label">Total LP Shares:</span>
              <span className="param-value mono">{config.totalShares.toString()}</span>
            </div>
            <div className="param-item">
              <span className="param-label">Underwriting Fee:</span>
              <span className="param-value">{(config.feeBps / 100).toFixed(2)}%</span>
            </div>
            <div className="param-item">
              <span className="param-label">Treasury Vault:</span>
              <a
                href={`https://explorer.solana.com/address/${config.treasury.toBase58()}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="chip mono"
                style={{ padding: "2px 8px", fontSize: 11 }}
              >
                {shortAddress(config.treasury)}
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                  <path d="M3.5 1.5H10.5V8.5" strokeWidth="1.5" />
                  <path d="M10.5 1.5L1.5 10.5" strokeWidth="1.5" />
                </svg>
              </a>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <svg
              className="empty-icon"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ margin: "4px 0", color: "var(--text)" }}>
              Pool Configuration Not Initialized
            </p>
            <p className="muted fine">
              Pool configuration account not found on-chain for the configured USDC mint.
            </p>
          </div>
        </div>
      )}

      {/* Policies Table Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span>Policies</span>
            <span
              className="chip mono"
              style={{ padding: "2px 8px", fontSize: 11, background: "rgba(36,112,255,0.1)" }}
            >
              {policies.length}
            </span>
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

        {policies.length === 0 ? (
          <div className="empty-state">
            <svg
              className="empty-icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>No policies created yet.</p>
            <p className="muted fine" style={{ marginTop: 4 }}>
              Switch to the "Buy Cover" tab to underwrite a delay policy for a shipment.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Policy ID</th>
                  <th>Bill of Lading</th>
                  <th>Insured</th>
                  <th>Coverage (USDC)</th>
                  <th>Settlement Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((entry) => {
                  const st = policyStatus(entry.policy, nowSecs);
                  const canSettle = st === "matured";
                  const isBusy = busyPolicy === entry.address.toBase58();

                  return (
                    <tr key={entry.address.toBase58()}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        #{entry.policy.policyId.toString()}
                      </td>
                      <td className="mono" style={{ color: "var(--text-secondary)" }}>
                        BL-{entry.policy.shipmentId.toString()}
                      </td>
                      <td>
                        <a
                          href={`https://explorer.solana.com/address/${entry.policy.insured.toBase58()}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono linklike"
                          title={entry.policy.insured.toBase58()}
                        >
                          {shortAddress(entry.policy.insured)}
                        </a>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {baseToUi(entry.policy.payoutAmount)}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {formatUnixTs(entry.policy.expectedDelivery + entry.policy.gracePeriod)}
                      </td>
                      <td>
                        <span className={`badge ${st}`}>
                          <span className="badge-dot" />
                          <span>{st}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {canSettle ? (
                          <button
                            className="small"
                            disabled={!publicKey || isBusy}
                            onClick={() => onSettle(entry)}
                            type="button"
                          >
                            {isBusy ? "Settling..." : "Settle Claim"}
                          </button>
                        ) : (
                          <span className="muted fine">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
