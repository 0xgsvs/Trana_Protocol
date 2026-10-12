/**
 * Rendered instead of the app when required env config is missing.
 * A thrown error here would be a blank white screen, so this is
 * deliberately the friendliest possible failure mode.
 */
export function SetupNotice() {
  return (
    <div className="container setup-notice">
      <div className="card">
        <div className="hero-tag">Configuration Required</div>
        <h1 className="hero-title" style={{ fontSize: 22, marginTop: 8 }}>
          Setup Notice: Missing USDC Mint
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The app could not find <code className="mono">VITE_USDC_MINT</code>. Copy{" "}
          <code className="mono">.env.example</code> to <code className="mono">.env</code> and fill
          it in, then restart the dev server:
        </p>

        <pre style={{ margin: "16px 0" }}>
          {`cp .env.example .env
# edit .env with your devnet mint address, then:
bun run dev`}
        </pre>

        <div
          style={{
            padding: "12px 14px",
            background: "rgba(9, 12, 19, 0.4)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="muted fine" style={{ margin: 0 }}>
            <code className="mono">VITE_USDC_MINT</code> is the USDC mint the pool was initialized
            with. To preview the UI, you can use any valid Solana address (e.g.{" "}
            <code className="mono">EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code>) — on-chain
            reads will report "not found" until the real pool is initialized.
          </p>
        </div>
      </div>
    </div>
  );
}
