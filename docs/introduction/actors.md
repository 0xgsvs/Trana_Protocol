# Actors & Roles

Five roles touch the program. Only three of them sign instructions, and only one
of those is trusted.

| Actor | Instruction | Signer | Authority required |
|---|---|---|---|
| Admin | `initialize_pool` | yes | none — first caller for a given mint |
| Liquidity Provider | `deposit_capital`, `withdraw_capital` | yes | owns the `LpPosition` |
| Insured (MFI / FPO) | `buy_policy` | yes | owns the destination account |
| Oracle Authority | `report_metric` | yes | must equal `config.oracle_authority` |
| Crank | `settle_policy` | yes | none — permissionless |

Every instruction requires a signer, including `settle_policy`. There are no
unsigned instruction paths.

## Admin

The admin is recorded at `initialize_pool` and is used for exactly one thing:
nothing. `PoolConfig.admin` is written and then never read by any handler — no
instruction is gated on it. It is an audit label, not a capability.

The admin's only real power is the one they exercise once: choosing
`oracle_authority` and `fee_bps` at initialisation. After that, **there is no
instruction that can change either value**. There are no admin setters in this
program, which means the oracle authority and the fee rate are immutable for the
life of the pool. This differs from the design document; see
[LOI vs Code](/appendix/loi-divergences).

## Liquidity Provider

An LP's position is a `LpPosition` PDA derived from `[b"lp_position", config, lp]`,
which means an LP can only ever touch their own position — the seeds force it,
and `withdraw_capital` additionally asserts `lp_position.lp == lp.key()`.

- `deposit_capital` mints shares. The first deposit into a pool mints 1 share per
  unit; later deposits mint at the prevailing ratio
  `amount * total_shares / total_capital`.
- `withdraw_capital` burns shares and pays out
  `shares * total_capital / total_shares`, capped by the pool's free capital.

An LP's exposure is real and unhedged: premium income accrues to
`total_capital`, payouts are subtracted from it, so the redemption value of a
share moves with the pool's underwriting result. There is no seniority tranche
and no loss cap in this program.

**What an LP cannot do:** withdraw against capital that is locking outstanding
payout risk. The `amount <= free_capital` guard is what keeps an LP from
stripping the pool while policies are live.

## Insured

The insured buys a policy by paying the premium up front. Two account-level
constraints shape their capabilities:

- `insured_usdc` is an ATA whose authority is the `insured` signer, so the
  premium must come from the buyer's own account.
- The payout destination at settlement is an ATA owned by `policy.insured` — the
  recorded insured, not the crank. A crank cannot redirect a payout, because
  the destination is derived from policy state rather than supplied freely.

**What the insured cannot do:** cancel a policy, obtain a refund, or settle
early. `expiry_ts` is a hard lower bound on settlement, and there is no path
that returns the premium.

## Oracle Authority

One keypair per pool, fixed at initialisation. It calls `report_metric` and is
the sole writer of `MetricReport` accounts; any other signer is rejected with
`Unauthorized`.

This is the program's centralisation point and it should be described honestly:
**the oracle decides whether a policy pays out.** A malicious or compromised
oracle authority can attest a value below any threshold and trigger payouts, or
attest a value above it and deny them. There is no challenge window, no
dispute mechanism, and no second source.

Two structural constraints bound the damage:

- Reports are one-way. `report_metric` uses `init`, so a `(target_id, period_id)`
  pair can be attested **exactly once** and nothing in the program updates or
  deletes it. A wrong observation is permanent.
- A payout cannot exceed the collateral locked against it, so an oracle cannot
  drain more than the policies it triggers were already reserving.

The production design calls for a TEE-attested oracle (Switchboard Functions
scraping Open-Meteo / NASA POWER). That integration is not in this repository —
`report_metric` accepts whatever the authority signs. See
[Threat Model](/security/threat-model).

## Crank

`settle_policy` is permissionless: the crank signs, pays the transaction fee, and
receives nothing. It cannot choose the outcome, redirect the payout, or settle a
policy that has not expired.

Because settlement is unprofitable, someone must be willing to pay for it.
Nothing in the program incentivises the crank, so liveness depends on an
external keeper. A settleable policy that nobody cranks leaves the insured
unpaid and `payout_amount` locked in `total_locked_risk`, which in turn
suppresses LP withdrawals. See
[Known Limitations](/security/known-limitations).

## Roles the program does not have

For clarity, since the design document implies some of these exist: there is no
governance multisig, no pause authority, no upgrade authority encoded in state,
no fee recipient, no LP unbonding queue, and no separate `TreasuryVault` account
type — the treasury is an SPL token account owned by the `PoolConfig` PDA.
