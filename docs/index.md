---
layout: home

hero:
  name: Parametric Risk Protocols
  text: Two fully-collateralised Anchor programs on Solana
  tagline: The reinsurance program underwrites district rainfall for rural lenders; the freight-delay program indemnifies shipments that arrive late. Pick one from the navigation above.
  actions:
    - theme: brand
      text: Reinsurance — Drought
      link: /reinsurance/introduction/overview
    - theme: alt
      text: Freight Delay — Shipping
      link: /freight_delay/introduction/overview

features:
  - title: Fully collateralised by construction
    details: total_locked_risk <= total_capital is re-checked at the end of every state-mutating instruction, not just at entry. A payout can never exceed capital that exists.
  - title: Parametric, not discretionary
    details: Reinsurance settles on an attested rainfall value below a threshold; Freight Delay settles on an attested arrival past an SLA plus grace. No claim forms, no loss adjuster, no subjective vote.
  - title: Permissionless settlement
    details: settle_policy is callable by any signer once a policy matures. The crank has no discretion — it only supplies compute.
  - title: Small, auditable surface
    details: Each program is six instructions, four account types, and one PDA-signed CPI, and is built from the same vault-and-shares skeleton.
---

## Two protocols, one skeleton

- **[Reinsurance](/reinsurance/introduction/overview)** — parametric drought
  reinsurance for rural lenders (MFIs and FPOs). Payouts trigger when an attested
  rainfall observation falls below a policy threshold.
- **[Freight Delay](/freight_delay/introduction/overview)** — parametric
  freight-delay indemnity for exporters and forwarders. Payouts trigger when an
  attested arrival lands after the quoted SLA plus a grace period.

LPs deposit USDC for shares, buyers pay premiums that lock payout risk, one oracle
authority attests observations, and settlement is permissionless. The two differ
only in what is attested — weather versus delivery.
