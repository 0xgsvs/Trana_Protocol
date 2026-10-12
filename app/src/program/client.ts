import { AnchorProvider, BN, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import idl from "./idl.json";
import { PROGRAM_ID } from "./constants";
import type { LpPosition, Policy, PoolConfig } from "./types";

export type FreightDelayProgram = Program<Idl>;

/** Build an Anchor program handle from a connection + wallet. */
export function getProgram(connection: Connection, wallet: Wallet): FreightDelayProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as Idl, provider);
  const idlAddress = (idl as { address?: string }).address;
  if (idlAddress && idlAddress !== PROGRAM_ID.toBase58()) {
    throw new Error(
      `IDL address ${idlAddress} does not match VITE_PROGRAM_ID ${PROGRAM_ID.toBase58()}. ` +
        `Replace src/program/idl.json with the real generated IDL.`,
    );
  }
  return program;
}

/** Build a read-only Anchor program handle from a connection (for viewing when disconnected). */
export function getReadOnlyProgram(connection: Connection): FreightDelayProgram {
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  } as unknown as Wallet;
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

/** sendAndConfirm through the program's provider (always set via getProgram). */
function sendTx(program: FreightDelayProgram, tx: Transaction): Promise<string> {
  const provider = program.provider as AnchorProvider | undefined;
  if (!provider) throw new Error("Program has no provider; connect a wallet first.");
  return provider.sendAndConfirm(tx);
}

const toBigint = (v: BN | number | bigint): bigint => BigInt(v.toString());
const toBN = (v: bigint): BN => new BN(v.toString());

function toPoolConfig(raw: any): PoolConfig {
  return {
    admin: raw.admin as PublicKey,
    oracleAuthority: raw.oracleAuthority as PublicKey,
    usdcMint: raw.usdcMint as PublicKey,
    treasury: raw.treasury as PublicKey,
    totalCapital: toBigint(raw.totalCapital),
    totalLockedRisk: toBigint(raw.totalLockedRisk),
    totalShares: toBigint(raw.totalShares),
    totalFees: toBigint(raw.totalFees),
    feeBps: raw.feeBps as number,
    bump: raw.bump as number,
  };
}

function toLpPosition(raw: any): LpPosition {
  return {
    lp: raw.lp as PublicKey,
    shares: toBigint(raw.shares),
    bump: raw.bump as number,
  };
}

function toPolicy(raw: any): Policy {
  return {
    insured: raw.insured as PublicKey,
    policyId: toBigint(raw.policyId),
    shipmentId: toBigint(raw.shipmentId),
    expectedDelivery: toBigint(raw.expectedDelivery),
    gracePeriod: toBigint(raw.gracePeriod),
    payoutAmount: toBigint(raw.payoutAmount),
    premiumAmount: toBigint(raw.premiumAmount),
    isSettled: raw.isSettled as boolean,
    isPaid: raw.isPaid as boolean,
    bump: raw.bump as number,
  };
}

/** Fetch a PoolConfig account, or null if it does not exist yet. */
export async function fetchPoolConfig(
  program: FreightDelayProgram,
  config: PublicKey,
): Promise<PoolConfig | null> {
  try {
    const raw = await (program.account as any).poolConfig.fetchNullable(config);
    return raw ? toPoolConfig(raw) : null;
  } catch {
    return null;
  }
}

/** Fetch an LpPosition account, or null if it does not exist yet. */
export async function fetchLpPosition(
  program: FreightDelayProgram,
  lpPosition: PublicKey,
): Promise<LpPosition | null> {
  try {
    const raw = await (program.account as any).lpPosition.fetchNullable(lpPosition);
    return raw ? toLpPosition(raw) : null;
  } catch {
    return null;
  }
}

/** Fetch a Policy account, or null if it does not exist. */
export async function fetchPolicy(
  program: FreightDelayProgram,
  policy: PublicKey,
): Promise<Policy | null> {
  try {
    const raw = await (program.account as any).policy.fetchNullable(policy);
    return raw ? toPolicy(raw) : null;
  } catch {
    return null;
  }
}

export interface PolicyWithAddress {
  address: PublicKey;
  policy: Policy;
}

/** List every Policy account for this program. */
export async function listPolicies(program: FreightDelayProgram): Promise<PolicyWithAddress[]> {
  try {
    const all = await (program.account as any).policy.all();
    return all.map((entry: { publicKey: PublicKey; account: any }) => ({
      address: entry.publicKey,
      policy: toPolicy(entry.account),
    }));
  } catch {
    return [];
  }
}

/**
 * Build a create-ATA instruction if the associated token account
 * does not exist yet. Returns null when it already exists.
 */
export async function maybeCreateAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): Promise<TransactionInstruction | null> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return null;
  return createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
}

/** Associated token address for (mint, owner). */
export function ataAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, owner);
}

export interface DepositParams {
  lp: PublicKey;
  config: PublicKey;
  usdcMint: PublicKey;
  treasury: PublicKey;
  lpPosition: PublicKey;
  lpAta: PublicKey;
  amount: bigint;
}

/** deposit_capital: move USDC into the treasury, mint LP shares. */
export async function depositCapital(
  program: FreightDelayProgram,
  params: DepositParams,
  extraIxs: TransactionInstruction[] = [],
): Promise<string> {
  if (extraIxs.length === 0) {
    return program.methods
      .depositCapital(toBN(params.amount))
      .accounts({
        lp: params.lp,
        config: params.config,
        usdcMint: params.usdcMint,
        treasury: params.treasury,
        lpUsdc: params.lpAta,
        lpPosition: params.lpPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
  const tx = new Transaction();
  for (const ix of extraIxs) tx.add(ix);
  const ix = await program.methods
    .depositCapital(toBN(params.amount))
    .accounts({
      lp: params.lp,
      config: params.config,
      usdcMint: params.usdcMint,
      treasury: params.treasury,
      lpUsdc: params.lpAta,
      lpPosition: params.lpPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(ix);
  return sendTx(program, tx);
}

export interface BuyPolicyParams {
  insured: PublicKey;
  config: PublicKey;
  usdcMint: PublicKey;
  treasury: PublicKey;
  policy: PublicKey;
  insuredAta: PublicKey;
  policyId: bigint;
  shipmentId: bigint;
  expectedDelivery: bigint;
  gracePeriod: bigint;
  payoutAmount: bigint;
  premiumAmount: bigint;
}

/** buy_policy: pay the premium, lock the payout risk, open the Policy PDA. */
export async function buyPolicy(
  program: FreightDelayProgram,
  params: BuyPolicyParams,
  extraIxs: TransactionInstruction[] = [],
): Promise<string> {
  const tx = new Transaction();
  for (const ix of extraIxs) tx.add(ix);
  const ix = await program.methods
    .buyPolicy(
      toBN(params.policyId),
      toBN(params.shipmentId),
      toBN(params.expectedDelivery),
      toBN(params.gracePeriod),
      toBN(params.payoutAmount),
      toBN(params.premiumAmount),
    )
    .accounts({
      insured: params.insured,
      config: params.config,
      usdcMint: params.usdcMint,
      treasury: params.treasury,
      insuredUsdc: params.insuredAta,
      policy: params.policy,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(ix);
  return sendTx(program, tx);
}

export interface SettleParams {
  crank: PublicKey;
  config: PublicKey;
  usdcMint: PublicKey;
  treasury: PublicKey;
  policy: PublicKey;
  deliveryReport: PublicKey;
  beneficiaryAta: PublicKey;
}

/**
 * settle_policy: permissionless. Anyone (the crank) can call it once
 * now >= expected_delivery + grace_period.
 */
export async function settlePolicy(
  program: FreightDelayProgram,
  params: SettleParams,
): Promise<string> {
  return program.methods
    .settlePolicy()
    .accounts({
      crank: params.crank,
      config: params.config,
      usdcMint: params.usdcMint,
      treasury: params.treasury,
      policy: params.policy,
      deliveryReport: params.deliveryReport,
      insuredUsdc: params.beneficiaryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export interface WithdrawParams {
  lp: PublicKey;
  config: PublicKey;
  usdcMint: PublicKey;
  treasury: PublicKey;
  lpPosition: PublicKey;
  lpAta: PublicKey;
  shares: bigint;
}

/** withdraw_capital: burn shares, reclaim pro-rata USDC from free capital. */
export async function withdrawCapital(
  program: FreightDelayProgram,
  params: WithdrawParams,
): Promise<string> {
  return program.methods
    .withdrawCapital(toBN(params.shares))
    .accounts({
      lp: params.lp,
      config: params.config,
      usdcMint: params.usdcMint,
      treasury: params.treasury,
      lpUsdc: params.lpAta,
      lpPosition: params.lpPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
