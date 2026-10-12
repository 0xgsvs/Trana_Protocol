/**
 * USDC amount conversions between UI units ("10.50") and on-chain
 * base units (10500000n for 6 decimals).
 *
 * Base units are bigints end to end: amounts above Number.MAX_SAFE_INTEGER
 * stay exact.
 */

export const DECIMALS = 6;

/**
 * Parse a UI amount like "10.5" into base units.
 * Throws on empty, negative, malformed, or over-precision input.
 */
export function uiToBase(input: string, decimals = DECIMALS): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Too many decimals: "${input}" (max ${decimals})`);
  }
  const padded = frac.padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/** Format base units back to a UI string, trimming trailing zeros. */
export function baseToUi(amount: bigint, decimals = DECIMALS): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** Unix seconds -> "YYYY-MM-DD HH:MM" (UTC) for display. */
export function formatUnixTs(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

/** "datetime-local" input value -> unix seconds. */
export function datetimeLocalToUnixSecs(value: string): bigint {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid datetime: "${value}"`);
  return BigInt(Math.floor(ms / 1000));
}

/** Days -> seconds (grace period input). */
export function daysToSecs(days: string): bigint {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid days: "${days}"`);
  return BigInt(Math.floor(n * 86400));
}
