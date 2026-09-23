# Parametric Risk Protocols

Two parametric risk protocols on Solana, sharing one design skeleton.

**Reinsurance** (`reinsurance/`) — drought reinsurance. Liquidity providers
deposit USDC into a fully collateralised pool. Rural lenders (MFIs and FPOs) buy
rainfall-threshold policies against their district. A designated oracle authority
attests what the weather actually did, and anyone can crank settlement to release
a payout.

**Freight Delay** (`freight_delay/`) — freight-delay indemnity. The same
pool-and-shares mechanism, but policies hedge a shipment arriving past its quoted
SLA. An oracle authority attests the actual arrival, and settlement pays out when
it lands after the deadline plus a grace period.

In both, every outstanding payout is backed by capital the pool already holds,
and that invariant is re-checked after every state change.

This repository holds the two Anchor programs and their documentation site.
There is no frontend, SDK, or indexer.

## Layout

```text
.
├── reinsurance/               # the drought-reinsurance Anchor program and its tests
├── freight_delay/             # the freight-delay Anchor program and its tests
├── docs/                      # the documentation site, one section per protocol
├── LOI_DELIVERABLE_TRANA.md          # the reinsurance program's design intent (original filename)
├── LOI_DELIVERABLE_FREIGHT_DELAY.md  # the freight-delay program's design intent
├── mise.toml                  # pinned toolchain (agave, anchor fork, surfpool, nextest, sccache, bun)
├── rust-toolchain.toml        # pinned Rust channel + components
└── .cargo/config.toml         # sccache as the rustc wrapper
```

`mise.toml`, `rust-toolchain.toml`, and `.cargo/config.toml` live at the root
and apply to both programs.

Each directory documents itself:

- **[`reinsurance/README.md`](reinsurance/README.md)** — the drought program:
  layout, toolchain, build and test, the instruction set, accounts, accounting
  rules, and what the program deliberately does not do.
- **[`freight_delay/README.md`](freight_delay/README.md)** — the freight-delay
  program, in the same shape.
- **[`docs/README.md`](docs/README.md)** — the documentation site: how to run it,
  the two-section structure, the theming, how diagrams are rendered, and the
  checks it runs.

## Quick start

```bash
# Reinsurance (drought).
cd reinsurance
mise install                 # agave, anchor, surfpool, nextest, sccache, bun
anchor build                 # -> target/deploy/reinsurance.so
cargo nextest run            # 15 LiteSVM tests

# Freight Delay.
cd ../freight_delay
anchor build                 # -> target/deploy/freight_delay.so
cargo nextest run            # 15 LiteSVM tests

# The documentation site.
cd ../docs
bun install
bun run dev                  # http://localhost:5173
```

`anchor build` must run before the tests: they load `target/deploy/<name>.so` at
compile time, so a stale build silently tests old code.

## Reading the documentation

The docs site is the reference for both protocols, split into two top-level
sections you choose from the navbar — `Reinsurance` and `Freight Delay` — each
with its own left-hand tree. Pages worth knowing first:

- `docs/reinsurance/protocol/instructions.md` and
  `docs/freight_delay/protocol/instructions.md` — every instruction with its full guard list
- `docs/reinsurance/protocol/invariants.md` and
  `docs/freight_delay/protocol/invariants.md` — the accounting rules each program enforces
- `docs/reinsurance/appendix/loi-divergences.md` and
  `docs/freight_delay/appendix/loi-divergences.md` — what each program deliberately
  does not implement

## A note on the design documents

`LOI_DELIVERABLE_TRANA.md` and `LOI_DELIVERABLE_FREIGHT_DELAY.md` are the original
proposals, **not** specifications. They describe features that were never built —
a withdrawal cooldown, a `TreasuryVault` account, governance setters for the fee
and oracle authority, and Switchboard TEE oracles. Read them for vocabulary; treat
each `programs/<name>/src` as the truth, and see the matching `appendix/` page for
the divergences.
