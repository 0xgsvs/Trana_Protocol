# Trana Protocol

Parametric drought reinsurance on Solana.

Liquidity providers deposit USDC into a fully collateralised pool. Rural lenders
(MFIs and FPOs) buy rainfall-threshold policies against their district. A
designated oracle authority attests what the weather actually did, and anyone can
crank settlement to release a payout. Every outstanding payout is backed by
capital the pool already holds.

This repository holds the on-chain program and its documentation site. There is no
frontend, SDK, or indexer.

## Layout

```text
.
├── trana/                     # the Anchor program and its tests
├── docs/                      # the documentation site
├── LOI_DELIVERABLE_TRANA.md   # original design intent
├── AGENTS.md                  # repo notes for coding agents
├── rust-toolchain.toml        # pinned Rust channel + components
└── .cargo/config.toml         # sccache as the rustc wrapper
```

Each directory documents itself:

- **[`trana/README.md`](trana/README.md)** — the program: layout, toolchain,
  build and test, the instruction set, accounts, accounting rules, and what the
  program deliberately does not do.
- **[`docs/README.md`](docs/README.md)** — the documentation site: how to run it,
  the theming, how diagrams are rendered, and the checks it runs.

## Quick start

```bash
# The program — `mise.toml` lives in trana/, so mise install runs there.
cd trana
mise install                 # agave, anchor, surfpool, nextest, sccache, bun
anchor build                 # -> target/deploy/trana.so
cargo nextest run            # 15 LiteSVM tests

# The documentation site.
cd ../docs
bun install
bun run dev                  # http://localhost:5173
```

`anchor build` must run before the tests: they load `target/deploy/trana.so` at
compile time, so a stale build silently tests old code.

## Reading the documentation

The docs site is the reference for the protocol. The pages worth knowing first:

- [`docs/protocol/instructions.md`](docs/protocol/instructions.md) — every
  instruction with its full guard list
- [`docs/protocol/invariants.md`](docs/protocol/invariants.md) — the accounting
  rules the program enforces
- [`docs/security/known-limitations.md`](docs/security/known-limitations.md) —
  what the program deliberately does not do

## A note on the design document

`LOI_DELIVERABLE_TRANA.md` is the original proposal, **not** the specification. It
describes features that were never built — a withdrawal cooldown, a `TreasuryVault`
account, governance setters for the fee and oracle authority. Read it for
vocabulary; treat `trana/programs/trana/src` as the truth.
