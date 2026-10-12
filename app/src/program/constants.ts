import { PublicKey } from "@solana/web3.js";

function requiredEnv(name: string, fallback = ""): string {
  const value = import.meta.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing ${name}: copy .env.example to .env and fill it in.`);
  }
  return value;
}

/** Program ID of the deployed freight_delay program. */
export const PROGRAM_ID = new PublicKey(
  requiredEnv("VITE_PROGRAM_ID", "HKygNZod2WmpPzDVHjcdv7kpd74t68zH9sE4Kp1mxAQP"),
);

/** RPC endpoint the app talks to. */
export const RPC_URL = requiredEnv("VITE_RPC_URL", "https://api.devnet.solana.com");

/**
 * USDC mint the pool was initialized with.
 * Returns null when VITE_USDC_MINT is not set — the app renders a setup
 * notice instead of crashing (see SetupNotice).
 */
export function usdcMint(): PublicKey | null {
  const value = import.meta.env["VITE_USDC_MINT"] as string | undefined;
  if (!value) return null;
  return new PublicKey(value);
}

/** USDC uses 6 decimals. */
export const USDC_DECIMALS = 6;

/** Anchor account discriminators, sha256("account:<Name>")[0..8]. */
export const ACCOUNT_DISCRIMINATORS = {
  PoolConfig: [26, 108, 14, 123, 116, 230, 129, 43],
  LpPosition: [105, 241, 37, 200, 224, 2, 252, 90],
  Policy: [222, 135, 7, 163, 235, 177, 33, 68],
  DeliveryReport: [108, 71, 51, 82, 1, 93, 22, 162],
} as const;
