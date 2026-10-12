import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";

/** Encode a u64 as 8 little-endian bytes (Anchor's u64 layout). */
export function u64LeBytes(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

/** PoolConfig PDA: ["config", usdc_mint]. */
export function poolConfigPda(usdcMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config"), usdcMint.toBuffer()], PROGRAM_ID);
}

/** Treasury token account PDA: ["treasury", config]. */
export function treasuryPda(config: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury"), config.toBuffer()], PROGRAM_ID);
}

/** LpPosition PDA: ["lp_position", config, lp_wallet]. */
export function lpPositionPda(config: PublicKey, lp: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp_position"), config.toBuffer(), lp.toBuffer()],
    PROGRAM_ID,
  );
}

/** Policy PDA: ["policy", config, policy_id_le_bytes]. */
export function policyPda(config: PublicKey, policyId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), config.toBuffer(), u64LeBytes(policyId)],
    PROGRAM_ID,
  );
}

/** DeliveryReport PDA: ["delivery", shipment_id_le_bytes]. */
export function deliveryReportPda(shipmentId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delivery"), u64LeBytes(shipmentId)],
    PROGRAM_ID,
  );
}
