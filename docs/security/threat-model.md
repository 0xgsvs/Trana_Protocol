# Threat Model

What the program defends against, what it does not, and who has to be trusted.
Written against the source as it exists, not as a production system might be
designed.

## Trust assumptions

| Party | Trusted for | Bound by |
|---|---|---|
| Oracle Authority | Correctness of every `observed_value` | One keypair, fixed at init, no challenge path |
| Admin | Nothing after initialisation | No instruction is gated on `admin` |
| Crank | Nothing | Settlement outcome is fully determined by state |
| LPs | Nothing | Cannot withdraw past free capital or another LP's position |
| Insured | Nothing | Pays up front; cannot cancel or redirect a payout |

The only genuine trust anchor is **the oracle authority keypair**. Everything
else is either constrained by account derivation or economically self-defeating.

## What an attacker cannot do

These are the properties the program actually enforces. Each was checked against
the account constraints and arithmetic rather than assumed.

**Drain the treasury.** All outflows go through `transfer_from_treasury`, which
signs with `[b"config", usdc_mint, bump]`. No external caller can produce those
seeds, so the token program rejects any transfer the program did not authorise.
There is no instruction that pays an arbitrary recipient: settlement pays the
ATA of `policy.insured`, and redemption pays the ATA of the `lp` signer.

**Redirect a payout.** The settlement destination is
`associated_token::authority = policy.insured` — derived from recorded policy
state, not from a caller-supplied account. A crank cannot point a payout at
itself.

**Redeem someone else's position.** `lp_position` is derived from
`[b"lp_position", config, lp]` *and* carries
`constraint = lp_position.lp == lp.key()`. Both must hold; a stranger's position
cannot be presented.

**Settle twice.** `is_settled` is checked first and set last, and nothing resets
it.

**Settle early.** `now >= expiry_ts` is a hard lower bound.

**Lock more risk than capital.** `free_capital() >= payout_amount` at purchase,
re-asserted by `assert_solvent()` after every mutation. This is the invariant
argued in full in [Invariants](/protocol/invariants).

**Overflow the accounting.** Every arithmetic path is `u64 → u128 → checked_* →
u64::try_from`, with failures mapped to `MathOverflow`. The release profile also
sets `overflow-checks = true`, but that is a second line of defence — the
checked operations are the contract.

**Corrupt state through account substitution.** Every already-initialised PDA is
pinned with `bump = <account>.bump`, the treasury asserts
`token::authority = config` and `token::mint = usdc_mint`, and user token
accounts assert `associated_token::authority`.

## What an attacker can do

**Trigger every policy, if they hold the oracle key.** A malicious authority
attests an observation below any threshold and every matching policy pays out.
There is no dispute window, no second source, and no way to correct a report.
The damage is bounded by the collateral already locked against those policies —
the pool cannot be drained beyond its commitments — but an entire season's risk
can be settled at will.

**Deny payouts, if they hold the oracle key.** The inverse attack costs nothing:
attest a value above the threshold and the policy settles unpaid. This is the
more dangerous direction for the insured, who has already paid the premium.

**Withhold attestation.** Refusing to call `report_metric` is enough to freeze a
policy forever. The locked capital cannot be withdrawn by LPs, and there is no
timeout that releases it. This requires no privilege beyond inaction.

**Spam policy IDs.** `policy_id` is caller-chosen, so any account can occupy
unclaimed IDs. IDs are not a scarce resource and carry no meaning beyond
uniqueness per pool.

**Choose a degenerate threshold.** Anyone can buy a policy with
`threshold = 0`, which cannot trigger. That harms only the buyer.

## Notable non-findings

Recorded because they look like bugs and are not:

**`free_capital()` uses `saturating_sub`.** This cannot mask an invariant breach.
`assert_solvent()` checks the same relation with a strict comparison, and every
call site of `free_capital()` treats the result as a ceiling. Saturation returns
zero, which is the fail-closed value.

**The metric-matching guard is unreachable.** `metric_report` is a PDA derived
from `policy.target_id` and `policy.period_id`, so the fields it holds always
equal the policy's. The check is defensive; it cannot fire.

**`PoolConfig.admin` is never read.** Not an omission — there is deliberately no
admin instruction. It is an audit label.

**`total_locked_risk` subtraction uses `checked_sub` even though it cannot
underflow.** The aggregate is exactly the sum over unsettled policies, so the
subtraction is always safe. Treating "provably impossible" as an error rather
than an assumption is the correct posture for on-chain code.

## Real weaknesses

| Weakness | Impact | Status |
|---|---|---|
| Single oracle authority, no dispute path | Payouts can be triggered or denied at will | By design; TEE oracle is out of scope for this repo |
| `MetricReport.timestamp` never validated | An observation taken before the policy existed settles it | Unimplemented check |
| No settlement deadline | Unattested policy locks capital permanently | No timeout or refund path exists |
| No crank incentive | Settleable policies may go unsettled | Liveness depends on external keeper |
| `total_fees` uncollectible | Fee revenue stranded in the treasury | No sweep instruction |
| `fee_bps` immutable, `10_000` permitted | A pool can be initialised at a 100% fee | Init guard is the only bound |
| Premium pricing is unmodelled | LPs rely on the free-capital gate, not actuarial pricing | Out of scope |

Each of these is expanded in [Known Limitations](/security/known-limitations).

## What is out of scope for the program

- **Stablecoin risk.** The pool's unit is USDC; a depeg is not modelled.
- **Legal and regulatory structure.** Off-chain, and not encoded here.
- **Data quality.** `report_metric` accepts whatever the authority signs. Feed
  integrity, station placement, and basis risk are entirely off chain.
- **Upgrade authority.** Not represented in program state. Whoever holds the
  program's upgrade key can replace the code, which dominates every guarantee on
  this page.
