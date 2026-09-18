# Error Codes

One flat enum, eleven variants, every one carrying a `#[msg]`. There are no
nested error types and no `anyhow` anywhere in the program.

```rust
#[error_code]
pub enum TranaError {
    Unauthorized,
    InvalidFee,
    InvalidAmount,
    InvalidExpiry,
    Insolvent,
    InsufficientFreeCapital,
    PolicyNotExpired,
    PolicyAlreadySettled,
    MetricMismatch,
    InsufficientShares,
    MathOverflow,
}
```

## Variants

Anchor numbers custom errors from 6000, in declaration order.

| Code | Variant | Message | Raised by |
|---|---|---|---|
| 6000 | `Unauthorized` | Only the configured authority may perform this action. | `report_metric` authority check; `withdraw_capital` `lp_position` constraint |
| 6001 | `InvalidFee` | Fee must be between 0 and 10,000 basis points. | `initialize_pool` |
| 6002 | `InvalidAmount` | Amount must be greater than zero. | `deposit_capital` (twice), `buy_policy` (twice), `withdraw_capital` (twice) |
| 6003 | `InvalidExpiry` | Policy expiry must be in the future. | `buy_policy` |
| 6004 | `Insolvent` | Pool is insolvent: locked risk would exceed total capital. | `buy_policy` free-capital gate; `assert_solvent()` |
| 6005 | `InsufficientFreeCapital` | Pool does not have enough unencumbered capital for this withdrawal. | `settle_policy` (triggered), `withdraw_capital` |
| 6006 | `PolicyNotExpired` | Policy has not expired yet. | `settle_policy` |
| 6007 | `PolicyAlreadySettled` | Policy has already been settled. | `settle_policy` |
| 6008 | `MetricMismatch` | Metric report does not match the policy target or period. | `settle_policy` — unreachable, see below |
| 6009 | `InsufficientShares` | Not enough shares to redeem. | `withdraw_capital` |
| 6010 | `MathOverflow` | Arithmetic overflow. | Every `checked_*` money path |

## Notes per variant

**`Unauthorized` serves two mechanisms.** In `report_metric` it is raised by an
explicit `require_keys_eq!`. In `withdraw_capital` it comes from an account
constraint (`constraint = lp_position.lp == lp.key() @ TranaError::Unauthorized`),
so the same code reaches the client from two very different checks.

**`InvalidAmount` is heavily overloaded.** It covers zero on the way in
(`amount != 0`, `shares != 0`, `payout != 0`, `premium != 0`) and also the case
where a valid input floors to nothing (`shares != 0` after share pricing,
`amount != 0` after redemption pricing). A client seeing 6002 cannot tell which
without inspecting its own arguments.

**`Insolvent` means capital adequacy.** The message describes locked risk
exceeding total capital, and it is raised both by the `buy_policy` entry gate and
by the closing `assert_solvent()` in all four state-mutating handlers. It is the
code to watch in production — reaching it from `assert_solvent()` would mean a
handler broke the invariant.

**`InsufficientFreeCapital` covers two different situations** with one message
about withdrawal: a triggered settlement where capital no longer covers the
payout, and a redemption exceeding free capital. The `settle_policy` case is
arguably an internal-consistency failure rather than a withdrawal problem.

**`MetricMismatch` is unreachable.** The `metric_report` account is derived from
`policy.target_id` and `policy.period_id` in its seeds, so the fields it holds
necessarily equal the policy's, and the equality check at `settle_policy.rs:58`
cannot fail. It is defensive code retained for clarity.

**`MathOverflow` is the catch-all for checked arithmetic.** Every money path
converts `u64 → u128`, applies `checked_*`, and maps failure through
`u64::try_from`. It also absorbs division by zero, so a `checked_div` with a zero
divisor surfaces as 6010 rather than a panic.

## What does *not* produce these codes

Failures from Anchor's own constraint checks bypass `TranaError` entirely:

| Symptom | Actual source |
|---|---|
| Wrong PDA supplied | `ConstraintSeeds` |
| Wrong bump | `ConstraintSeeds` / `ConstraintHasOne` |
| Treasury authority or mint mismatch | `ConstraintTokenOwner` / `ConstraintTokenMint` |
| ATA missing or wrong owner | `AccountNotInitialized` / token program error |
| Policy or metric already initialised | `AccountAlreadyInitialized` |
| Token transfer with insufficient balance | SPL Token error |

When a test asserts `is_err()` without decoding the code, it cannot distinguish
these from a `TranaError`. See [Testing](/development/testing).

## Related

- [Testing](/development/testing) — which codes the suite actually asserts
- [Instructions](/protocol/instructions) — the guard order in each handler
