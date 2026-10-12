# Trana Frontend

React + TypeScript frontend for the Trana Protocol freight-delay program
(`freight_delay` on Solana). Scaffold per the CHA-22 stack decision: Bun,
Vite 8, Vitest, Oxc, mise, React SPA, monorepo `app/` layout.

## Setup

```bash
mise trust        # once per clone
mise install      # installs pinned bun
bun install
cp .env.example .env   # then fill in VITE_USDC_MINT (and RPC if not devnet)
bun run dev       # http://localhost:5173
```

## Scripts

| Script           | What it does                             |
| ---------------- | ---------------------------------------- |
| `bun run dev`    | Vite dev server                          |
| `bun run build`  | `tsc --noEmit` + production build        |
| `bun run test`   | Vitest unit tests (no network)           |
| `bun run lint`   | oxlint                                   |
| `bun run format` | oxfmt (write) · `format:check` to verify |

## The IDL placeholder

`src/program/idl.json` is a **placeholder**, not the real program IDL — the
protocol repo does not commit one. It was reconstructed from the repo docs:

- Instruction names/args and account field layouts match the documented
  interface; discriminators follow the Anchor `sha256("global:<name>")[0..8]`
  convention.
- **The per-instruction account lists are best-effort** (especially
  `settlePolicy`'s beneficiary token account). They must be checked against
  the generated IDL before any real transaction.

To install the real IDL, see `scripts/fetch-idl.sh`: run `anchor build` in
the protocol repo's `freight_delay/` workspace and copy
`target/idl/freight_delay.json` over `src/program/idl.json`. The typed
wrappers in `src/program/client.ts` are written against the documented
interface, so they work unchanged once the real IDL is in place.

## Views

- **Shipper** — `buy_policy` form: policy/shipment IDs, expected delivery,
  grace period, payout + premium. Shows the computed settlement deadline.
- **Liquidity** — `deposit_capital` / `withdraw_capital` plus the connected
  wallet's `LpPosition` (shares, pro-rata value, pool share).
- **Pool** — `PoolConfig` stats (total/free capital, locked risk, shares,
  fees) and the policy list with per-policy status and a permissionless
  **Settle** button once `now >= expected_delivery + grace_period`.

No UI is built for `report_delivery_milestone`: that is the old push-oracle
model being replaced by pull attestations (CHA-16).

## Notes

- Amounts are 6-decimal USDC; `src/lib/amounts.ts` converts UI ↔ base units
  with bigints end to end.
- Wallet support: Phantom + Solflare via the standard wallet adapters.
- Tests never touch the network: PDA derivation is checked against
  `findProgramAddressSync` with the documented seeds, amounts are pure.
