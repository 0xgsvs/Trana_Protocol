import { useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { ataAddress, buyPolicy, maybeCreateAtaIx } from "../program/client";
import { policyPda } from "../program/pdas";
import { useFreightDelay } from "../program/useProgram";
import {
  baseToUi,
  datetimeLocalToUnixSecs,
  daysToSecs,
  formatUnixTs,
  uiToBase,
} from "../lib/amounts";

export function ShipperView() {
  const { program, isWalletConnected, publicKey, configPda, treasuryPda, mint } = useFreightDelay();
  const { connection } = useConnection();

  const [policyId, setPolicyId] = useState("1");
  const [shipmentId, setShipmentId] = useState("1001");
  const [expectedDelivery, setExpectedDelivery] = useState(() => {
    // Default to 7 days from now
    const d = new Date(Date.now() + 7 * 86400 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [graceDays, setGraceDays] = useState("3");
  const [payout, setPayout] = useState("10000");
  const [premium, setPremium] = useState("2500");
  const [status, setStatus] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deadline = useMemo(() => {
    try {
      if (!expectedDelivery) return null;
      const exp = datetimeLocalToUnixSecs(expectedDelivery);
      return exp + daysToSecs(graceDays || "0");
    } catch {
      return null;
    }
  }, [expectedDelivery, graceDays]);

  const protectionMultiple = useMemo(() => {
    try {
      const p = parseFloat(payout);
      const pr = parseFloat(premium);
      if (pr > 0 && p > 0) {
        return (p / pr).toFixed(2);
      }
      return null;
    } catch {
      return null;
    }
  }, [payout, premium]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!program || !publicKey || !mint || !configPda || !treasuryPda) {
      setStatus("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setTxSignature(null);
    try {
      const pid = BigInt(policyId);
      const [policy] = policyPda(configPda, pid);
      const insuredAta = await ataAddress(mint, publicKey);
      const createIx = await maybeCreateAtaIx(connection, publicKey, publicKey, mint);
      const sig = await buyPolicy(
        program,
        {
          insured: publicKey,
          config: configPda,
          usdcMint: mint,
          treasury: treasuryPda,
          policy,
          insuredAta,
          policyId: pid,
          shipmentId: BigInt(shipmentId),
          expectedDelivery: datetimeLocalToUnixSecs(expectedDelivery),
          gracePeriod: daysToSecs(graceDays),
          payoutAmount: uiToBase(payout),
          premiumAmount: uiToBase(premium),
        },
        createIx ? [createIx] : [],
      );
      setTxSignature(sig);
      setStatus(`Policy #${policyId} successfully purchased!`);
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="hero-header">
        <div className="hero-tag">Parametric Coverage</div>
        <h1 className="hero-title">Buy Delay Insurance</h1>
        <p className="hero-subtitle">
          Protect ocean freight against transit delays. Instant onchain settlement executes
          automatically when port oracles attest arrival after the grace deadline.
        </p>
      </div>

      <div className="grid-shipper">
        {/* Left Form Column */}
        <form onSubmit={onSubmit} className="card form">
          <h2 className="card-title">Configure Cargo Policy</h2>

          <div className="grid2">
            <div className="form-field">
              <label className="form-label">
                <span>Policy ID</span>
                <span className="mono fine">u64 identifier</span>
              </label>
              <input
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                placeholder="1"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">
                <span>Shipment ID</span>
                <span className="mono fine">Bill of Lading</span>
              </label>
              <input
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                placeholder="1001"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Expected Port Delivery</span>
              <span className="fine muted">Scheduled arrival (UTC)</span>
            </label>
            <input
              type="datetime-local"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Grace Period</span>
              <span className="fine muted">Buffer before breach triggers</span>
            </label>
            <div className="input-wrapper">
              <input
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                placeholder="3"
                required
              />
              <span className="input-suffix">Days</span>
            </div>
            <div className="chip-group">
              {["1", "2", "3", "5", "7"].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="preset-chip"
                  onClick={() => setGraceDays(d)}
                >
                  +{d} {d === "1" ? "Day" : "Days"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Desired Payout Cover</span>
              <span className="fine muted">Guaranteed compensation</span>
            </label>
            <div className="input-wrapper">
              <input
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                placeholder="10000"
                required
              />
              <span className="input-suffix">USDC</span>
            </div>
            <div className="chip-group">
              {["5000", "10000", "25000", "50000"].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="preset-chip mono"
                  onClick={() => setPayout(amt)}
                >
                  ${Number(amt).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Quoted Premium</span>
              <span className="fine muted">Upfront underwriting cost</span>
            </label>
            <div className="input-wrapper">
              <input
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder="2500"
                required
              />
              <span className="input-suffix">USDC</span>
            </div>
          </div>

          <button type="submit" className="btn-block" disabled={busy || !isWalletConnected}>
            {!isWalletConnected
              ? "Connect Wallet to Purchase"
              : busy
                ? "Confirming Onchain..."
                : "Purchase Delay Cover"}
          </button>
        </form>

        {/* Right Quotation Breakdown Column */}
        <div>
          <div className="card">
            <h2 className="card-title">Quotation Summary</h2>

            <div className="summary-panel" style={{ marginTop: 14 }}>
              <div className="summary-row">
                <span className="summary-label">Cargo Shipment Ref</span>
                <span className="summary-value mono">BL-{shipmentId || "—"}</span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Delay Payout Guarantee</span>
                <span className="summary-value accent">
                  {payout ? Number(payout).toLocaleString() : "—"} USDC
                </span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Upfront Premium</span>
                <span className="summary-value">
                  {premium ? Number(premium).toLocaleString() : "—"} USDC
                </span>
              </div>

              {protectionMultiple && (
                <div className="summary-row">
                  <span className="summary-label">Protection Leverage</span>
                  <span className="summary-value mono" style={{ color: "var(--good)" }}>
                    {protectionMultiple}x Payout Multiple
                  </span>
                </div>
              )}

              <div className="summary-row">
                <span className="summary-label">Breach Settlement Deadline</span>
                <span
                  className="summary-value fine"
                  style={{ maxWidth: "60%", textAlign: "right" }}
                >
                  {deadline ? formatUnixTs(deadline) : "Fill in delivery & grace"}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "12px 14px",
                background: "rgba(9, 12, 19, 0.4)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="muted fine" style={{ marginBottom: 4 }}>
                <strong>How settlement works:</strong>
              </div>
              <p className="muted fine" style={{ margin: 0 }}>
                If the AIS maritime oracle registers carrier port arrival after the settlement
                deadline, the policy matures and anyone can crank the claim to instantly release{" "}
                {payout || "0"} USDC to your wallet.
              </p>
            </div>

            <div style={{ marginTop: 14 }}>
              <p className="muted fine" style={{ margin: 0 }}>
                Base units preview: Payout {safeBase(payout)} · Premium {safeBase(premium)}
              </p>
            </div>
          </div>
        </div>
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

function safeBase(input: string): string {
  try {
    return `${baseToUi(uiToBase(input))} USDC (${uiToBase(input).toString()} units)`;
  } catch {
    return "—";
  }
}
