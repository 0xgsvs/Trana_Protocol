# Economics

Two pieces of arithmetic define the protocol's economics: how shares are priced,
and how premiums are split. Both are integer arithmetic that floors, and both
have consequences worth stating precisely.

## Share pricing

An LP's position is a share count, not a USDC balance. Shares are minted and
burned at the pool's prevailing ratio:

```text
deposit:   shares = amount * total_shares / total_capital      (first deposit: shares = amount)
withdraw:  amount = shares * total_capital / total_shares
```

Because `total_capital` includes net premium income and excludes realised
payouts, **the redemption value of a share moves with the pool's underwriting
result.** That is the intended risk transfer: LPs are not depositors earning a
fixed rate, they are underwriters whose share price rises with premium income and
falls with payouts.

### Worked example

A pool at `fee_bps = 200` (2%), with one LP and one policy:

| Step | `total_capital` | `total_locked_risk` | `total_shares` | `total_fees` | Share price |
|---|---|---|---|---|---|
| LP deposits 1,000,000 | 1,000,000 | 0 | 1,000,000 | 0 | 1.000 |
| Policy: payout 500,000, premium 50,000 | 1,049,000 | 500,000 | 1,000,000 | 1,000 | 1.049 |
| Settlement, **triggered** | 549,000 | 0 | 1,000,000 | 1,000 | 0.549 |
| Settlement, **not triggered** | 1,049,000 | 0 | 1,000,000 | 1,000 | 1.049 |

The premium split is `fee = 50,000 * 200 / 10,000 = 1,000` and
`net_premium = 49,000`. Sixty per cent of the pool was wiped out by one
triggered policy — which is exactly what full collateralisation means: the pool
held the money, and now the insured holds it.

### Fund conservation

The treasury balance is determined by the accounting at all times:

```text
treasury balance = total_capital + total_fees
```

In the table above, after the premium is collected the treasury holds 1,050,000
against `total_capital = 1,049,000` and `total_fees = 1,000`. After a triggered
settlement it holds 550,000 against 549,000 + 1,000. An LP can audit the pool
against the token account without trusting any off-chain number.

## Fee arithmetic

```rust
let fee = (premium_amount as u128)
    .checked_mul(self.config.fee_bps as u128)
    .and_then(|v| v.checked_div(FEE_DENOMINATOR as u128))
    .and_then(|v| u64::try_from(v).ok())
    .ok_or(TranaError::MathOverflow)?;
let net_premium = premium_amount.checked_sub(fee).ok_or(TranaError::MathOverflow)?;
```

The intermediate is `u128`, so `premium * fee_bps` cannot overflow for any
`u64` premium. The division floors, so the fee is rounded **down** in the
insured's favour by at most one base unit. `premium - fee` cannot underflow
because `fee_bps <= 10_000` is enforced at initialisation, so `fee <= premium`.

### `fee_bps = 10_000` is a hazard

The initialisation guard admits any value up to and including 10,000 basis
points, i.e. 100%. At that setting every premium is taken as fee,
`net_premium = 0`, and selling a policy adds nothing to `total_capital` while
still locking `payout_amount` against it. The pool's free capital shrinks with
each sale and never grows from premium. The invariant still holds — the gate
prevents locking more than capital — but the pool is strictly worse off per
sale. Nothing in the program prevents this configuration, and `fee_bps` is
immutable once the pool exists.

## Fees are stranded

`total_fees` increases on every `buy_policy` and is **never decremented by any
instruction**. No handler reads the field. There is no admin sweep, no fee
recipient, and no path that transfers `total_fees` anywhere.

The consequence is precise: the fee USDC physically sits in the treasury and is
excluded from every claim. LPs cannot withdraw it — `withdraw_capital` is capped
by `free_capital()`, which is derived from `total_capital` alone. The admin
cannot withdraw it either. If every LP redeems every share, `total_capital` goes
to zero and the treasury still holds `total_fees` in tokens that no party can
reach.

So protocol fee revenue is, as currently written, **accounting-only and
uncollectible**. This is not a solvency bug and it does not affect the
collateralisation invariant; it is an unimplemented revenue path. Fee revenue is
not conflated with LP capital, which is the important part: the fee does not
inflate the share base, so LPs are neither credited nor diluted by it.

## Rounding

Both pricing formulas floor, and both floors favour the pool:

```text
deposit:   floor division → depositor receives slightly fewer shares than the exact ratio
withdraw:  floor division → redeemer receives slightly less USDC than the exact ratio
```

A round trip through the pool therefore cannot profit. Concretely, with
`total_capital = 1,049,000` and `total_shares = 1,000,000`, a 100,000 deposit
mints `floor(100,000 * 1,000,000 / 1,049,000) = 95,328` shares; redeeming those
shares returns `floor(95,328 * 1,049,000 / 1,000,000) = 99,999` USDC. The
depositor paid 100,000 and got back 99,999, with the single unit of dust
retained by the pool.

The magnitude is bounded by one base unit per operation, so it is not an
economic attack surface — but it does mean the pool is very slightly
dust-positive over time, which is the correct direction.

### Division by zero

Both divisions are guarded by `checked_div`. In `withdraw_capital` the divisor is
`total_shares`, which cannot be zero when the function proceeds: a `shares != 0`
guard has already passed and `shares <= lp_position.shares` has been checked, so
some LP holds shares. In `deposit_capital` the divisor is `total_capital`, only
reached when `total_shares != 0`; a state with shares outstanding and zero
capital is unreachable, because a triggered settlement always leaves capital
above zero (the solvency gate requires `payout <= free_capital`, and the premium
is strictly positive, so `payout < total_capital`). Both are defensive: if either
assumption failed the result would be `MathOverflow`, not a panic or a silent
wrap.

## Pricing risk is not priced on chain

Nothing in this program computes a premium, an expected loss, or a risk load. The
insured and the pool's existing state determine `premium_amount` by fiat, and the
only check is that free capital covers the payout. An LP's protection against a
badly priced policy is the free-capital gate, not an actuarial model.

## Related

- [Invariants](/protocol/invariants) — why the accounting cannot break
- [Accounts & State](/protocol/accounts) — where these fields live
- [Known Limitations](/security/known-limitations) — the stranded-fee and lock-up consequences
