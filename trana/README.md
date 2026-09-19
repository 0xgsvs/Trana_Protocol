# trana

The Anchor program behind Trana Protocol: a parametric drought-reinsurance pool on
Solana.

One pool per USDC mint. Liquidity providers deposit USDC and receive shares.
Insured lenders buy a policy that pays out when the attested rainfall for their
district and season falls below a threshold. A single oracle authority writes
those observations, and settlement is permissionless — anyone can crank it once a
policy has expired.

The pool is **fully collateralised at all times**: every outstanding payout is
backed by capital the pool already holds, and that invariant is re-checked after
every state change.

Program ID: `En2EGbw2JuJkQbmgueXEN2XaiBjHvzf4bPwCrUyTqMNf`

## Layout

```text
trana/
├── Anchor.toml               # cluster, wallet, program id, [scripts] test
├── mise.toml                 # pinned toolchain
├── Cargo.toml                # workspace + release profile
├── txtx.yml                  # localnet / devnet environments for the deploy runbook
├── programs/trana/
│   ├── Cargo.toml            # anchor-lang + anchor-spl 1.2.0, LiteSVM dev-deps
│   ├── src/
│   │   ├── lib.rs            # #[program] — six instructions, forwarding ctx.bumps
│   │   ├── instructions.rs   # flat `pub mod` + `pub use` list
│   │   ├── instructions/     # one file per instruction: Accounts struct + handler
│   │   ├── state.rs          # PoolConfig, LpPosition, Policy, MetricReport
│   │   ├── constants.rs      # the five PDA seeds and FEE_DENOMINATOR
│   │   ├── error.rs          # TranaError — 11 flat variants
│   │   └── events.rs         # six events, one per instruction
│   └── tests/test_trana.rs   # 15 LiteSVM tests
└── runbooks/                 # Surfpool deployment scaffolding (has its own README)
```

## Toolchain

Everything comes from `mise.toml`; nothing needs installing by hand:

```bash
mise install     # agave, otter-sec/anchor, surfpool, cargo-nextest, sccache, bun
```

The Anchor pin is the `otter-sec/anchor` fork, and the Rust channel plus
components come from `../rust-toolchain.toml`. `sccache` is wired in as the
`rustc-wrapper` through `../.cargo/config.toml`.

Program dependencies are deliberately narrow: `anchor-lang` 1.2.0 (with
`init-if-needed`, used only by `deposit_capital`) and `anchor-spl` 1.2.0. The
release profile turns on `overflow-checks` with `lto = "fat"` and
`codegen-units = 1`.

## Build and test

```bash
cd trana
anchor build                  # -> target/deploy/trana.so
cargo nextest run             # 15 tests — this is Anchor.toml [scripts].test
cargo check --all-targets     # fast type-check loop
```

**Build first, always.** `tests/test_trana.rs` loads `target/deploy/trana.so`
with `include_bytes!` at compile time, so running the tests against a stale build
silently tests old code. `cargo test` is not the test command; `cargo nextest run`
is.

## How it works

| Role | Does |
|---|---|
| Admin | `initialize_pool` once: sets `fee_bps` and the oracle authority, and creates the pool's treasury token account. |
| LP | `deposit_capital` mints shares against the pool. `withdraw_capital` burns them for a share of the capital that is not locked against outstanding payouts. |
| Insured lender | `buy_policy` pays a premium, credited to the pool net of fee, and locks the policy's payout against the pool's capital. |
| Oracle authority | `report_metric` attests one observation per `(target_id, period_id)`. |
| Crank — anyone | `settle_policy` after expiry pays the insured if the attested value is below the threshold. |

### PDAs

| Account | Seeds | Notes |
|---|---|---|
| `PoolConfig` | `[b"config", usdc_mint]` | All pool accounting lives here. |
| treasury | `[b"treasury", config]` | An SPL token account owned by the token program, with `PoolConfig` as its authority — the only account the program signs for. |
| `LpPosition` | `[b"lp_position", config, lp]` | Share balance per LP. |
| `Policy` | `[b"policy", config, policy_id_le]` | One per purchase. |
| `MetricReport` | `[b"metric", target_id_le, period_id_le]` | **Not** namespaced by pool: district and period are global, and a report is written once. |

### Instructions

| Instruction | Signer | Effect | Notable guards |
|---|---|---|---|
| `initialize_pool` | admin | Creates `PoolConfig` and the treasury | `fee_bps <= 10_000` |
| `deposit_capital` | LP | USDC → treasury, mints shares | `amount != 0`, `shares != 0` |
| `buy_policy` | insured | Premium → treasury, locks payout risk | `payout != 0`, `premium != 0`, `expiry_ts > now`, `free_capital >= payout` |
| `report_metric` | oracle authority only | Creates the `MetricReport` | `reporter == config.oracle_authority` |
| `settle_policy` | any signer | Pays the insured iff triggered, always releases the locked risk | not already settled, `now >= expiry_ts`, report matches the policy's target and period |
| `withdraw_capital` | LP | Treasury → LP, burns shares | `shares != 0`, `shares <= position.shares`, `amount != 0`, `amount <= free_capital` |

The full guard list, with the account-level constraints that act as guards too
(`associated_token::authority`, `token::authority = config`, bump pinning), is in
[`../docs/protocol/instructions.md`](../docs/protocol/instructions.md).

### Accounting

`PoolConfig` is the single source of truth:

```text
free_capital() = total_capital - total_locked_risk        (saturating)
solvency      : total_locked_risk <= total_capital        (assert_solvent)
```

- **Deposit** — `shares = amount` for the first deposit, otherwise
  `amount * total_shares / total_capital`.
- **Buy** — `fee = premium * fee_bps / 10_000`, `net = premium - fee`; the pool
  credits `net` to `total_capital`, adds `fee` to `total_fees`, and adds the
  payout to `total_locked_risk`. The transfer is for the **gross** premium.
- **Withdraw** — `amount = shares * total_capital / total_shares`, capped by
  `free_capital`.
- **Settle** — `total_locked_risk -= payout` always; on a triggered policy the
  pool also debits `total_capital`, transfers the payout to the insured and sets
  `is_paid`.

All money math goes `u64 → u128 → checked_* → u64::try_from`, and every division
floors, so rounding never leaves the pool short. `fee_bps` is basis points against
`FEE_DENOMINATOR = 10_000`.

Two orderings are deliberate and easy to break. The solvency gate in `buy_policy`
reads `free_capital` **before** the premium is credited, so a premium can never
fund its own payout. And every state-mutating handler ends with
`config.assert_solvent()` and only then emits its event.

## Test harness

- **LiteSVM**, not `anchor-client` and not a validator: `litesvm` +
  `litesvm-token`, with `solana-awesome` re-exports. All 15 tests live in
  `programs/trana/tests/test_trana.rs`.
- Each test builds a fresh `LiteSVM` through `setup()`, airdrops four keypairs and
  creates the USDC mint plus both ATAs. There is no shared fixture, so tests
  cannot leak state into one another.
- Time is set explicitly with `set_ts()`, which writes the `Clock` sysvar. Nothing
  sleeps or waits on wall-clock time.
- Most assertions read events: `parse_event()` scans `Program data:` logs for the
  expected discriminator rather than inspecting account state.

## Known limitations

These are design decisions, not bugs:

- `report_metric` uses `init` and nothing updates or deletes a report, so a
  district and period can be attested **exactly once**. A wrong observation is
  permanent.
- Settlement requires the report to exist. A policy whose district was never
  attested keeps its payout locked in `total_locked_risk` forever — there is no
  timeout and no refund path.
- There are no setters for `fee_bps` or `oracle_authority` after initialisation.

[`../docs/security/known-limitations.md`](../docs/security/known-limitations.md)
has the full list.

## Conventions

- A handler's body lives in `impl<'info> X<'info>` in that instruction's own file;
  `lib.rs` only forwards `ctx.bumps`.
- Register a new handler in **both** `instructions.rs` and `lib.rs`.
- Never reorder fields in an `#[account]` struct or arguments in an instruction:
  both layouts are positional, and `InitSpace` silently recomputes rather than
  erroring. Never edit a seed literal or `declare_id!` — every PDA address derives
  from them.
- Account space is always `8 + X::INIT_SPACE`; new accounts are filled with
  `set_inner`.

## Where to read more

- [`../docs/protocol/architecture.md`](../docs/protocol/architecture.md) — how the
  accounts and instructions fit together
- [`../docs/protocol/invariants.md`](../docs/protocol/invariants.md) — the
  accounting rules
- [`../docs/workflows/lifecycle.md`](../docs/workflows/lifecycle.md) — the pool's
  life from initialisation to settlement
- [`../docs/development/testing.md`](../docs/development/testing.md) — the test
  suite in detail
- `programs/trana/AGENTS.md` — the same ground rules aimed at coding agents
