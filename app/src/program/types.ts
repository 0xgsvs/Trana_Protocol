import type { PublicKey } from "@solana/web3.js";

/** Mirrors the on-chain PoolConfig account. */
export interface PoolConfig {
  admin: PublicKey;
  oracleAuthority: PublicKey;
  usdcMint: PublicKey;
  treasury: PublicKey;
  totalCapital: bigint;
  totalLockedRisk: bigint;
  totalShares: bigint;
  totalFees: bigint;
  feeBps: number;
  bump: number;
}

/** Mirrors the on-chain LpPosition account. */
export interface LpPosition {
  lp: PublicKey;
  shares: bigint;
  bump: number;
}

/** Mirrors the on-chain Policy account. */
export interface Policy {
  insured: PublicKey;
  policyId: bigint;
  shipmentId: bigint;
  expectedDelivery: bigint;
  gracePeriod: bigint;
  payoutAmount: bigint;
  premiumAmount: bigint;
  isSettled: boolean;
  isPaid: boolean;
  bump: number;
}

/** Mirrors the on-chain DeliveryReport account. */
export interface DeliveryReport {
  shipmentId: bigint;
  actualDelivery: bigint;
  terminalCode: bigint;
  timestamp: bigint;
  reporter: PublicKey;
  bump: number;
}

/** Derived, UI-facing status of a policy. */
export type PolicyStatus = "awaiting" | "matured" | "settled-unpaid" | "paid";

export function policyStatus(policy: Policy, nowSecs: number): PolicyStatus {
  if (policy.isSettled) {
    return policy.isPaid ? "paid" : "settled-unpaid";
  }
  const deadline = policy.expectedDelivery + policy.gracePeriod;
  return nowSecs >= deadline ? "matured" : "awaiting";
}

/** Free capital backing new policies: total_capital - total_locked_risk. */
export function freeCapital(config: PoolConfig): bigint {
  return config.totalCapital - config.totalLockedRisk;
}

/** Pro-rata USDC value of an LP's shares. */
export function positionValue(config: PoolConfig, position: LpPosition): bigint {
  if (config.totalShares === 0n) return 0n;
  return (position.shares * config.totalCapital) / config.totalShares;
}
