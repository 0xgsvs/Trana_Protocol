# Known Limitations

Conditions the program cannot recover from, or drops on the floor. These are
properties of the code as written, and several are deliberate scope decisions
rather than defects — but any integrator needs them before putting capital at
risk.

## 1. An unattested district locks capital permanently

`settle_policy` requires the `MetricReport` account to exist:

```rust
#[account(
    seeds = [METRIC_SEED, policy.target_id.to_le_bytes().as_ref(), policy.period_id.to_le_bytes().as_ref()],
    bump = metric_report.bump,
)]
pub metric_report: Account<'info, MetricReport>,
```

If nobody reports `(target_id, period_id)`, that account does not exist, the
instruction cannot even resolve its accounts, and the policy can never settle.

What stays stuck:

- `payout_amount` remains in `total_locked_risk` forever.
- The matching capital can never be withdrawn by LPs, because
  `withdraw_capital` is capped by `free_capital = total_capital - total_locked_risk`.
- There is no timeout, no expiry-based release, no refund, and no way to void a
  policy.

The insured also never recovers the premium. This is the single most
consequential limitation in the program: **a district that is simply not reported
impairs LP capital permanently, without any drought occurring.** Mitigation is
entirely operational — the oracle authority must report every `(target_id,
period_id)` pair it has policies against, and nothing on chain enforces that.

## 2. Reports are write-once and cannot be corrected

`report_metric` uses `init`, so each `(target_id, period_id)` pair can be
attested exactly once. There is no update instruction and no delete instruction.

Consequences:

- A typo, a wrong unit, or a stale value is permanent.
- The damage is shared: because `MetricReport` is not namespaced by pool,
  every policy across every pool reading that pair settles against the same
  number.
- There is no mechanism to supersede a report with a corrected one.

The intended fix is an oracle-level one (attest once, correctly, from a TEE), not
a program-level one.

## 3. The observation timestamp is never checked

`report_metric` stores `timestamp: Clock::unix_timestamp`, and **no handler reads
the field**. Nothing validates that the observation was taken:

- inside the policy's risk window,
- after the policy was purchased, or
- before settlement.

So a value attested months before a policy existed settles that policy just as
validly as a contemporaneous one. Combined with write-once reporting, a policy's
outcome may effectively be determined on the day its district is first reported
— which could be long before the season the policy covers.

This is a missing check, not a design decision. A freshness or period-window
validation is the obvious remediation.

## 4. No settlement deadline

`settle_policy` requires `now >= expiry_ts` with no upper bound. A policy can be
settled years after expiry, and until someone does, its payout stays locked in
`total_locked_risk` and out of reach of LPs.

There is no "settle by" deadline and no automatic release. Combined with
limitation 1, an expired-and-unreported policy is indistinguishable from a live
one, forever.

## 5. Settlement is unprofitable, so liveness is external

`settle_policy` is permissionless and unpaid. The crank pays the transaction fee
and receives nothing. Nothing in the program rewards settlement, so a policy that
is economically settleable may simply go unsettled until someone altruistic or
incentivised happens to call it.

The party with the strongest incentive to crank is the insured (who is owed a
payout) or an LP (who wants capital unlocked). The program does not encode either
incentive.

## 6. Protocol fees are uncollectible

`total_fees` increments on every `buy_policy` and is never decremented. No
handler reads it, and there is no sweep or recipient instruction.

The tokens are physically in the treasury and excluded from every claim:

- LPs cannot reach them — redemption is capped by `free_capital()`, derived from
  `total_capital` alone.
- The admin cannot reach them — no instruction pays out fees.
- If every LP redeems fully, the treasury still holds at least `total_fees`.

So fee revenue is accounting-only. The good news is that it is *cleanly*
separated: fees never inflate `total_capital`, so LPs are neither credited nor
diluted by them. See [Economics](/protocol/economics).

## 7. Immutable configuration, including a bad fee

Nothing can change `fee_bps` or `oracle_authority` after `initialize_pool`. There
are no setters at all, which also means:

- A compromised oracle key cannot be rotated. The pool must be abandoned.
- A mistyped `oracle_authority` cannot be repaired.
- `fee_bps = 10_000` (100%) is accepted by the init guard and is permanent. At
  that setting premiums contribute nothing to `total_capital`, so the pool pays
  out risk without earning anything for it.

The absence of setters is a defensible minimalism, but it makes initialisation
parameters irreversible.

## 8. No crank-side or oracle-side incentive design

Neither role is compensated. The oracle authority is a trusted party who must
keep reporting; the crank is an unpaid volunteer. Both are liveness dependencies
with no on-chain funding.

## 9. The design document describes a larger protocol

`LOI_DELIVERABLE_TRANA.md` specifies `request_withdrawal` with a 14-day unbonding
cooldown, a `TreasuryVault` struct, `unbonding_shares` and `unbonding_timestamp`
fields, and governance setters. None of it exists in `src/` — withdrawal is
immediate and unqueued, the treasury is an SPL token account, and there are no
setters.

Anyone reading the design document as a specification will form a materially
wrong picture of the program. The full comparison is in
[LOI vs Code](/appendix/loi-divergences).

## What is *not* on this list

For balance, things that hold up under inspection:

- Full collateralisation, inductive across every handler —
  [argued here](/protocol/invariants).
- No overflow, wrap, or unchecked arithmetic anywhere in the money paths.
- No path that moves tokens without a matching accounting entry, or vice versa.
- Treasury is genuinely unreachable without program-derived seeds.
- Positions are bound to their owner by both seeds and an explicit constraint.
- Rounding consistently favours the pool.

## Related

- [Threat Model](/security/threat-model) — what an attacker can and cannot do
- [Testing](/development/testing) — which of these are covered by tests (few)
- [Economics](/protocol/economics) — the fee and share arithmetic
