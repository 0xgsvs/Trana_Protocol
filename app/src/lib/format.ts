import type { PublicKey } from "@solana/web3.js";

/** "4BtU...1uqGJs" style shortening for display. */
export function shortAddress(key: PublicKey, chars = 4): string {
  const s = key.toBase58();
  return `${s.slice(0, chars)}...${s.slice(-chars)}`;
}
