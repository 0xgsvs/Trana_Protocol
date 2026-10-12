import { describe, expect, it } from "vitest";
import { baseToUi, datetimeLocalToUnixSecs, daysToSecs, uiToBase } from "./amounts";

describe("uiToBase", () => {
  it("converts whole units", () => {
    expect(uiToBase("10")).toBe(10_000_000n);
  });

  it("converts fractional units", () => {
    expect(uiToBase("10.5")).toBe(10_500_000n);
    expect(uiToBase("0.000001")).toBe(1n);
  });

  it("handles large amounts exactly", () => {
    // Above Number.MAX_SAFE_INTEGER in base units; must stay exact.
    expect(uiToBase("1000000000.123456")).toBe(1_000_000_000_123_456n);
  });

  it("rejects bad input", () => {
    expect(() => uiToBase("")).toThrow();
    expect(() => uiToBase("-5")).toThrow();
    expect(() => uiToBase("1.2345678")).toThrow(); // 7 decimals
    expect(() => uiToBase("abc")).toThrow();
    expect(() => uiToBase("1,000")).toThrow();
  });
});

describe("baseToUi", () => {
  it("formats whole amounts without decimals", () => {
    expect(baseToUi(10_000_000n)).toBe("10");
  });

  it("trims trailing zeros", () => {
    expect(baseToUi(10_500_000n)).toBe("10.5");
    expect(baseToUi(1n)).toBe("0.000001");
  });

  it("round-trips with uiToBase", () => {
    for (const s of ["0", "1", "10.5", "999999.999999", "0.000001"]) {
      expect(baseToUi(uiToBase(s))).toBe(s);
    }
  });
});

describe("datetimeLocalToUnixSecs", () => {
  it("parses a datetime-local value with explicit offset deterministically", () => {
    // Z-suffixed input: identical result in every timezone.
    expect(datetimeLocalToUnixSecs("2026-01-15T12:00:00Z")).toBe(1768478400n);
  });

  it("interprets offset-less input in local time (datetime-local picker)", () => {
    const expected = BigInt(Math.floor(new Date(2026, 0, 15, 12, 0).getTime() / 1000));
    expect(datetimeLocalToUnixSecs("2026-01-15T12:00")).toBe(expected);
  });

  it("rejects garbage", () => {
    expect(() => datetimeLocalToUnixSecs("not-a-date")).toThrow();
  });
});

describe("daysToSecs", () => {
  it("converts days to seconds", () => {
    expect(daysToSecs("3")).toBe(259_200n);
    expect(daysToSecs("0.5")).toBe(43_200n);
  });

  it("rejects negative input", () => {
    expect(() => daysToSecs("-1")).toThrow();
  });
});
