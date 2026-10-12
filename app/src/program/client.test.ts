import { describe, expect, it } from "vitest";
import { Connection, Keypair } from "@solana/web3.js";
import type { Wallet } from "@coral-xyz/anchor";
import { getProgram, getReadOnlyProgram } from "./client";
import { PROGRAM_ID } from "./constants";

describe("Anchor Program initialization", () => {
  const connection = new Connection("https://api.devnet.solana.com");
  const kp = Keypair.generate();
  const dummyWallet = {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  } as unknown as Wallet;

  it("instantiates read-only program without errors", () => {
    const program = getReadOnlyProgram(connection);
    expect(program.programId.toBase58()).toBe(PROGRAM_ID.toBase58());
    expect(program.methods.buyPolicy).toBeDefined();
    expect(program.methods.depositCapital).toBeDefined();
    expect(program.methods.settlePolicy).toBeDefined();
    expect(program.methods.withdrawCapital).toBeDefined();
    expect((program.account as any).poolConfig).toBeDefined();
    expect((program.account as any).lpPosition).toBeDefined();
    expect((program.account as any).policy).toBeDefined();
    expect((program.account as any).deliveryReport).toBeDefined();
  });

  it("instantiates wallet-authenticated program without throwing Event not found error", () => {
    const program = getProgram(connection, dummyWallet);
    expect(program.programId.toBase58()).toBe(PROGRAM_ID.toBase58());
    expect(program.provider.publicKey?.toBase58()).toBe(kp.publicKey.toBase58());
  });
});
