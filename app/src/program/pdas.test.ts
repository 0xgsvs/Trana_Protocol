import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import {
  deliveryReportPda,
  lpPositionPda,
  policyPda,
  poolConfigPda,
  treasuryPda,
  u64LeBytes,
} from "./pdas";

describe("u64LeBytes", () => {
  it("encodes little-endian", () => {
    expect(u64LeBytes(1n)).toEqual(Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]));
    expect(u64LeBytes(0x0102030405060708n)).toEqual(Buffer.from([8, 7, 6, 5, 4, 3, 2, 1]));
  });
});

describe("PDA derivation", () => {
  const mint = Keypair.generate().publicKey;
  const lp = Keypair.generate().publicKey;

  it("is deterministic", () => {
    expect(poolConfigPda(mint)[0].equals(poolConfigPda(mint)[0])).toBe(true);
    expect(policyPda(mint, 7n)[0].equals(policyPda(mint, 7n)[0])).toBe(true);
    expect(deliveryReportPda(1001n)[0].equals(deliveryReportPda(1001n)[0])).toBe(true);
  });

  it("matches raw findProgramAddressSync with the documented seeds", () => {
    const [config] = poolConfigPda(mint);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), mint.toBuffer()],
      PROGRAM_ID,
    );
    expect(config.equals(expected)).toBe(true);

    const [treasury] = treasuryPda(config);
    const [expectedTreasury] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), config.toBuffer()],
      PROGRAM_ID,
    );
    expect(treasury.equals(expectedTreasury)).toBe(true);

    const [position] = lpPositionPda(config, lp);
    const [expectedPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_position"), config.toBuffer(), lp.toBuffer()],
      PROGRAM_ID,
    );
    expect(position.equals(expectedPosition)).toBe(true);

    const [policy] = policyPda(config, 42n);
    const policyIdBytes = Buffer.alloc(8);
    policyIdBytes.writeBigUInt64LE(42n);
    const [expectedPolicy] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), config.toBuffer(), policyIdBytes],
      PROGRAM_ID,
    );
    expect(policy.equals(expectedPolicy)).toBe(true);

    const [delivery] = deliveryReportPda(1001n);
    const shipmentIdBytes = Buffer.alloc(8);
    shipmentIdBytes.writeBigUInt64LE(1001n);
    const [expectedDelivery] = PublicKey.findProgramAddressSync(
      [Buffer.from("delivery"), shipmentIdBytes],
      PROGRAM_ID,
    );
    expect(delivery.equals(expectedDelivery)).toBe(true);
  });

  it("separates PDAs by policy id", () => {
    const [config] = poolConfigPda(mint);
    expect(policyPda(config, 1n)[0].equals(policyPda(config, 2n)[0])).toBe(false);
  });

  it("returns valid bump seeds", () => {
    const [, bump] = poolConfigPda(mint);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});
