# Events

Six events, one per instruction, all defined in `events.rs`. Each is emitted at
the **end** of its handler — after state mutation and after `assert_solvent()` —
so an emitted event is proof that the transaction succeeded and its effects are
durable.

Events are the intended integration surface for indexers: they carry the state a
client needs without requiring account re-reads.

## `PoolInitialized`

```rust
pub struct PoolInitialized {
    pub config: Pubkey,
    pub usdc_mint: Pubkey,
    pub treasury: Pubkey,
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub fee_bps: u16,
}
```

Emitted by `initialize_pool`. Captures the immutable configuration: neither
`oracle_authority` nor `fee_bps` can change later, so this event is the
authoritative record of both.

## `CapitalDeposited`

```rust
pub struct CapitalDeposited {
    pub config: Pubkey,
    pub lp: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub total_capital: u64,
}
```

Emitted by `deposit_capital`. `shares_minted` is the floored result of the share
pricing, so a client tracking LP positions can reconcile from events alone
without calling the share formula itself. `total_capital` is read post-mutation.

## `PolicyPurchased`

```rust
pub struct PolicyPurchased {
    pub config: Pubkey,
    pub policy: Pubkey,
    pub insured: Pubkey,
    pub policy_id: u64,
    pub target_id: u64,
    pub period_id: u64,
    pub threshold: u64,
    pub payout_amount: u64,
    pub premium_amount: u64,
    pub expiry_ts: i64,
}
```

Emitted by `buy_policy`. Duplicates the full policy terms, which is the point: an
indexer can build its policy table from events without ever deserialising a
`Policy` account.

Note what is absent — the fee split. `net_premium` and `fee` are derivable from
`premium_amount` and the pool's `fee_bps` (from `PoolInitialized`), but they are
not emitted directly.

## `MetricReported`

```rust
pub struct MetricReported {
    pub config: Pubkey,
    pub target_id: u64,
    pub period_id: u64,
    pub observed_value: u64,
    pub timestamp: i64,
    pub reporter: Pubkey,
}
```

Emitted by `report_metric`. `config` is included for convenience even though the
`MetricReport` account is not namespaced by pool — the emitting pool is recorded,
the account is shared.

`timestamp` is `Clock::unix_timestamp` at attestation. It is emitted here and
stored on the account, but **no handler ever reads it**, so nothing on chain
enforces any relationship between attestation time, the risk period, and
settlement.

## `PolicySettled`

```rust
pub struct PolicySettled {
    pub config: Pubkey,
    pub policy: Pubkey,
    pub insured: Pubkey,
    pub triggered: bool,
    pub payout_amount: u64,
    pub observed_value: u64,
    pub threshold: u64,
}
```

Emitted by `settle_policy` on both branches. `triggered` distinguishes a payout
from a risk release, and it is the only event field that says whether tokens
actually moved — `payout_amount` is non-zero even when `triggered` is false,
because it reports the policy term rather than the transfer.

A client reconstructing cash flows must read `triggered` before treating
`payout_amount` as a payment. This is the easiest way to misread the event
stream.

## `CapitalWithdrawn`

```rust
pub struct CapitalWithdrawn {
    pub config: Pubkey,
    pub lp: Pubkey,
    pub shares_burned: u64,
    pub amount: u64,
    pub total_capital: u64,
}
```

Emitted by `withdraw_capital`. `shares_burned` is the input, `amount` the floored
redemption value — so the event records the effective share price of the
transaction, which is what an LP's accounting needs.

## Reading events

Anchor events are emitted as `Program data: <base64>` log lines, prefixed with an
8-byte discriminator derived from the event name. The test suite decodes them
by matching that discriminator:

```rust
fn parse_event<T>(res: &TransactionResult) -> T
where
    T: AnchorDeserialize + Discriminator,
{
    let logs = &res.as_ref().expect("transaction failed").logs;
    let discriminator: &[u8] = T::DISCRIMINATOR;
    for log in logs {
        if let Some(b64) = log.strip_prefix("Program data: ") {
            let bytes = B64.decode(b64.trim()).expect("valid base64 event");
            if bytes.len() >= 8 && bytes[..8] == *discriminator {
                return T::try_from_slice(&bytes[8..]).expect("event decodes");
            }
        }
    }
    panic!("event not found in logs");
}
```

Because a transaction can emit several events, a decoder must match on the
discriminator rather than assuming the first `Program data:` line is the one it
wants.

## Related

- [Testing](/development/testing) — how events are asserted
- [Instructions](/protocol/instructions) — where each event is emitted
