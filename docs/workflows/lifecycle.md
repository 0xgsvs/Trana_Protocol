# Pool Lifecycle

The whole protocol, from initialisation to settlement, in the order it happens.

## End-to-end sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor LP as Liquidity Provider
    actor Insured as Insured MFI / FPO
    participant Program as Trana program
    participant Treasury as Treasury
    actor Oracle as Oracle Authority
    actor Crank

    rect rgb(15, 118, 110, 0.12)
    Note over Admin, Treasury: Stage 1 — initialisation
    Admin->>Program: initialize_pool(fee_bps, oracle)
    Program->>Treasury: init, authority = PoolConfig
    Program-->>Admin: PoolInitialized
    end

    rect rgb(15, 118, 110, 0.12)
    Note over LP, Treasury: Stage 2 — capitalisation
    LP->>Program: deposit_capital(amount)
    Program->>Program: price shares
    Program->>Treasury: transfer USDC
    Program->>Program: capital += amount
    Program-->>LP: CapitalDeposited
    end

    rect rgb(15, 118, 110, 0.12)
    Note over Insured, Treasury: Stage 3 — risk placement
    Insured->>Program: buy_policy(terms)
    Program->>Program: require free_capital >= payout
    Program->>Treasury: transfer premium
    Program->>Program: lock payout risk
    Program-->>Insured: PolicyPurchased
    end

    rect rgb(15, 118, 110, 0.12)
    Note over Oracle, Program: Stage 4 — attestation
    Oracle->>Program: report_metric(target, period, value)
    Program->>Program: require oracle_authority
    Program-->>Oracle: MetricReported
    end

    rect rgb(15, 118, 110, 0.12)
    Note over Crank, Insured: Stage 5 — settlement
    Crank->>Program: settle_policy()
    Program->>Program: require expired and unsettled
    alt observed below threshold
        Program->>Treasury: transfer payout
        Treasury-->>Insured: USDC
    else observed at or above threshold
        Note over Program: risk released, no transfer
    end
    Program->>Program: release locked risk
    Program-->>Crank: PolicySettled
    end

    rect rgb(15, 118, 110, 0.12)
    Note over LP, Treasury: Stage 6 — redemption
    LP->>Program: withdraw_capital(shares)
    Program->>Program: require amount <= free_capital
    Program->>Treasury: transfer USDC
    Treasury-->>LP: USDC
    Program-->>LP: CapitalWithdrawn
    end
```

Stages 2 and 3 can interleave freely: policies can be sold the moment the pool
holds capital, and more capital can arrive while policies are live. Stage 4 must
precede stage 5 for a given `(target_id, period_id)` — `settle_policy` requires
the `MetricReport` account to exist, and there is no fallback if it does not.

## Timeline

```mermaid
gantt
    title Policy lifecycle relative to expiry
    dateFormat X
    axisFormat %s
    section Placement
    Pool capitalised          :done, s1, 0, 90
    Policy purchased          :done, s2, 90, 20
    section Risk period
    Payout locked in total_locked_risk :active, s3, 110, 880
    section Settlement
    Expiry passes             :milestone, m1, 990, 0
    Oracle attests observation :s4, 990, 60
    Crank settles             :s5, 1050, 20
    section After settlement
    Risk released, capital freed :s6, 1070, 300
```

The gap between purchase and expiry is the risk period, during which the payout
is locked and LPs cannot withdraw against it. Settlement is permitted at any
point after expiry — the crank step above is drawn as a short window, but the
program imposes no deadline, and a policy that is never cranked stays locked
indefinitely.

## Pool state machine

```mermaid
stateDiagram-v2
    [*] --> Uninitialised
    Uninitialised --> Empty : initialize_pool
    Empty --> Capitalised : deposit_capital
    Capitalised --> Capitalised : deposit_capital, buy_policy, settle_policy, report_metric
    Capitalised --> Empty : withdraw_capital drains total_capital
```

There is no terminal or frozen state. The pool has no pause, no shutdown, and no
migration path; it is a permanent state machine.

## Policy state machine

```mermaid
stateDiagram-v2
    [*] --> Active : buy_policy
    Active --> Paid : settle_policy when observation is below threshold
    Active --> Released : settle_policy when observation is at or above threshold
    Paid --> [*]
    Released --> [*]
```

`Paid` and `Released` are both terminal, distinguished by the `is_paid` flag.
`Active` is terminal in practice for any policy whose district is never attested:
`settle_policy` needs the `MetricReport` account to exist, so the transition never
becomes available. See [Known Limitations](/security/known-limitations).

## Instruction dependency graph

```mermaid
flowchart TD
    Init["initialize_pool"] --> Dep["deposit_capital"]
    Init --> Rep["report_metric"]
    Dep --> Buy["buy_policy"]
    Buy --> Settle["settle_policy"]
    Rep --> Settle
    Dep --> With["withdraw_capital"]
    Settle -.->|frees locked risk| With
```

Read the dotted edge as the only coupling between settlement and redemption:
`settle_policy` lowers `total_locked_risk`, which raises `free_capital`, which is
the ceiling on `withdraw_capital`. Until policies settle, LP capital is not fully
withdrawable.

## Next

- [LP Capital](/workflows/lp-capital) — the deposit and redemption paths in detail
- [Policy Settlement](/workflows/policy-settlement) — placement, attestation, settlement
