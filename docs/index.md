---
layout: home

hero:
  name: Trana Protocol
  text: Parametric drought reinsurance on Solana
  tagline: LPs underwrite district-level rainfall risk; rural lenders buy USDC-settled hedges; a permissionless crank settles them without a loss adjuster.
  actions:
    - theme: brand
      text: Protocol Overview
      link: /introduction/overview
    - theme: alt
      text: Architecture
      link: /protocol/architecture
    - theme: alt
      text: Instruction Reference
      link: /reference/instructions

features:
  - title: Fully collateralised by construction
    details: total_locked_risk <= total_capital is re-checked at the end of every state-mutating instruction, not just at entry. A payout can never exceed capital that exists.
  - title: Parametric, not discretionary
    details: Settlement compares an oracle-attested observation against the policy threshold. No claim forms, no loss adjuster, no subjective vote.
  - title: Permissionless settlement
    details: settle_policy is callable by any signer once a policy expires. The crank has no discretion — it only supplies compute.
  - title: Single-program, auditable surface
    details: Six instructions, four account types, eleven error variants, and one PDA-signed CPI. The whole program is under 1,600 lines of Rust.
---
