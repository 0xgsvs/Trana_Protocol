# Scope & Status

This documentation describes what is in the repository, verified against the
source. It is not a roadmap.

## What this repository contains

```text
Trana_Protocol/
├── trana/
│   ├── programs/trana/
│   │   ├── src/            # the Anchor program (~1.6k lines of Rust)
│   │   └── tests/          # LiteSVM integration tests (682 lines, 15 tests)
│   ├── runbooks/           # surfpool / txtx deploy scaffolding
│   └── Anchor.toml
├── mise.toml               # toolchain pins
├── LOI_DELIVERABLE_TRANA.md  # design intent (partly stale — see appendix)
└── docs/                   # this site
```

The program is the whole deliverable. There is no frontend, no client SDK, no
indexer, no API service, and no on-chain oracle integration.

## What exists on chain

| Surface | Count | Detail |
|---|---|---|
| Instructions | 6 | `initialize_pool`, `deposit_capital`, `buy_policy`, `report_metric`, `settle_policy`, `withdraw_capital` |
| Account types | 4 | `PoolConfig`, `LpPosition`, `Policy`, `MetricReport` |
| Error variants | 11 | One flat `TranaError` enum |
| Events | 6 | One per instruction |
| Outbound CPIs | 1 | `transfer_from_treasury`, SPL Token `transfer` |

## What is explicitly *not* implemented

Each of these appears in the design document or in a plausible reading of the
protocol, and none of them exists in `src/`:

- **`request_withdrawal` and the 14-day unbonding cooldown.** Withdrawal is
  immediate; there is no `unbonding_shares` or `unbonding_timestamp` field, and
  the string `unbonding` appears nowhere in the program.
- **A `TreasuryVault` account struct.** The treasury is an SPL `TokenAccount`
  owned by the token program with the `PoolConfig` PDA as authority.
- **Any governance or admin setter.** `fee_bps` and `oracle_authority` are fixed
  at initialisation and cannot be changed. `PoolConfig.admin` is never read.
- **An oracle integration.** No Switchboard, no TEE, no HTTP. `report_metric`
  trusts the configured authority keypair unconditionally.
- **A fee withdrawal path.** `total_fees` accrues and can never be paid out.
- **A refund or timeout for unsettleable policies.** If a district is never
  reported, the locked risk is permanent.
- **A crank incentive.** Settlement is permissionless and unpaid.

The [LOI vs Code](/appendix/loi-divergences) appendix lists these divergences
against the specific sections of the design document that claim them.

## Maturity

The program has never been deployed to a public cluster in this repository's
history. `Anchor.toml` configures `localnet` only, with the program id pinned as
`En2EGbw2JuJkQbmgueXEN2XaiBjHvzf4bPwCrUyTqMNf`.

Test coverage is 15 LiteSVM integration tests covering the happy path of every
instruction plus several rejection cases. The suite passes. It is not a security
audit, and the gaps are documented in [Testing](/development/testing) — most
notably, no test exercises a second deposit, no test asserts a specific error
code, and no test covers arithmetic boundaries.

Treat the program as pre-audit. The invariant that matters (full
collateralisation) does hold under the arithmetic as written, and that is argued
in [Invariants](/protocol/invariants) rather than asserted.
