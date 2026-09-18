# Testing

The suite is 15 integration tests in `trana/programs/trana/tests/test_trana.rs`,
running against LiteSVM with the compiled program loaded as bytes. There is no
validator, no `anchor-client`, and no network.

## Running

```bash
cd trana
anchor build        # mandatory — tests embed the .so at compile time
cargo nextest run
```

15 tests, all passing, in about a second.

## Harness

| Piece | Purpose |
|---|---|
| `setup()` | Fresh `LiteSVM`, 4 airdropped keypairs, USDC mint, both ATAs |
| `set_ts()` | Writes the `Clock` sysvar to pin time |
| `send()` | `expire_blockhash()`, then builds and submits a legacy `VersionedTransaction` |
| `parse_event()` | Scans `Program data:` logs for an event discriminator |
| `read_config()` / `read_policy()` | `try_deserialize` an account |
| `balance()` | SPL token amount of an ATA |
| `funded_pool(n)` | Setup + `initialize_pool` + `deposit_capital(n)` |

Two conventions are worth preserving:

**Time is set, never waited for.** Every test that cares about expiry calls
`set_ts(&mut env.svm, ...)` and writes the `Clock` sysvar directly. There are no
sleeps, no polling, and no wall-clock dependency anywhere in the suite.

**There is no shared fixture.** Each test calls `setup()` and gets a fresh SVM
with fresh keypairs, so tests cannot leak state into each other. Do not introduce
cross-test state to save setup time.

Determinism note: `send()` calls `expire_blockhash()` before building each
transaction, and the keypairs are random per test. The randomness does not affect
outcomes, because every test asserts on balances and accounting rather than on
addresses.

## What is covered

| Test | Asserts |
|---|---|
| `initialize_pool_sets_state` | All `PoolConfig` fields, treasury mint/owner/balance to zero, event |
| `initialize_pool_rejects_fee_above_denominator` | `fee_bps = 10_001` rejected |
| `deposit_capital_mints_shares_one_to_one` | First deposit mints 1:1, position written, treasury funded, event |
| `deposit_capital_rejects_zero` | `amount = 0` rejected |
| `buy_policy_locks_risk_and_collects_net_premium` | Fee split, risk locked, all policy fields, treasury holds gross premium, event |
| `buy_policy_rejects_payout_above_free_capital` | Payout exceeding free capital rejected |
| `report_metric_requires_oracle_authority` | Non-authority rejected, **and no account created** |
| `report_metric_writes_attested_observation` | Report fields and timestamp, event |
| `settle_pays_insured_on_drought_trigger` | Payout transferred, `is_paid`, capital and locked risk reconciled, event |
| `settle_releases_risk_when_threshold_not_met` | Risk released, no transfer, `is_settled && !is_paid`, event |
| `settle_rejects_before_expiry` | Premature settle rejected |
| `settle_rejects_double_settlement` | Second settle rejected |
| `withdraw_capital_returns_usdc_and_burns_shares` | Shares burned, capital and treasury reduced, event |
| `withdraw_rejects_amount_above_free_capital` | Redemption beyond free capital rejected |
| `withdraw_rejects_unknown_position` | Stranger cannot redeem, including a funded ATA |

The strongest of these are the two settlement tests: they reconcile the treasury
balance against `total_capital + total_fees`, which checks the fund-conservation
identity from [Invariants](/protocol/invariants) rather than just the mutated
fields. `report_metric_requires_oracle_authority` is also better than it looks —
asserting the account is still absent proves the failure happened before
mutation, not after.

## What is not covered

Honest list, in rough order of how much it matters.

**No test asserts an error code.** Every rejection test uses `assert!(res.is_err())`.
A test named `buy_policy_rejects_payout_above_free_capital` would still pass if
the guard raised `InvalidExpiry`, or if the transaction failed for a rent or
account-resolution reason. Six of the eleven `TranaError` variants have no direct
assertion at all: `InvalidExpiry`, `MetricMismatch`, `InsufficientShares`,
`InsufficientFreeCapital`, and `MathOverflow` are never decoded from a failure,
and `PolicyNotExpired` is only inferred from `is_err()`.

**No test performs a second deposit.** Every deposit test starts from
`total_shares == 0`, so the non-trivial branch of the share formula
(`amount * total_shares / total_capital`) is never executed, and share-price
behaviour across multiple LPs is unverified.

**No arithmetic boundary tests.** There is no `u64::MAX` deposit, payout, or
share count; no test that `fee_bps = 10_000` (the accepted maximum) behaves as
described; and no overflow-path test asserting `MathOverflow` specifically.

**No duplicate-report test.** The write-once property of `report_metric` — a
central design constraint, since a report can never be corrected — is not
asserted by attempting a second report for the same pair.

**No unattested-district test.** The permanent lock-up described in
[Known Limitations](/security/known-limitations) has no test documenting it,
despite being the protocol's most consequential failure mode.

**No expiry bound test.** `InvalidExpiry` is never triggered: no test buys a
policy with `expiry_ts <= now`.

**No multi-policy test.** Every test uses at most one live policy, so aggregate
`total_locked_risk` across several policies is never exercised.

## Adding a test

Follow the existing shape: `setup()` or `funded_pool()`, build the instruction
with `Instruction::new_with_bytes` and the generated `accounts::` struct, `send()`,
then read state back and assert.

To assert a specific error, decode it rather than checking `is_err()` — a
corrected test looks like this:

```rust
let res = buy_policy(&mut env, 1, payout, premium, BASE_TS + EXPIRY_DELTA);
let err = res.expect_err("should reject");
// Assert on the specific Triton/Anchor error code, not merely that it failed.
let logs = err.meta.logs.join("\n");
assert!(logs.contains("Insolvent"), "unexpected error: {logs}");
```

Asserting on program logs is the least invasive way to pin a `#[msg]` string
without introducing an error-code dependency. The stronger form is to match the
numeric `InstructionError::Custom(code)` from the transaction error, which pins
the variant rather than the message text.

## Related

- [Local Setup](/development/local-setup) — build and toolchain prerequisites
- [Invariants](/protocol/invariants) — what the suite does and does not prove
- [Error Codes](/reference/errors) — the variants worth asserting
