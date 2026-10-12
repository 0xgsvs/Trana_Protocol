import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Wallet } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { getProgram, getReadOnlyProgram, type FreightDelayProgram } from "./client";
import { poolConfigPda, treasuryPda } from "./pdas";
import { usdcMint } from "./constants";

export interface FreightDelayContext {
  /** The Anchor program instance (connected wallet instance when connected, read-only otherwise). */
  program: FreightDelayProgram;
  isWalletConnected: boolean;
  publicKey: PublicKey | null;
  configPda: PublicKey | null;
  treasuryPda: PublicKey | null;
  mint: PublicKey | null;
}

/**
 * Shared program context: connection + wallet + derived PDAs.
 * Always returns a valid `program` (read-only if no wallet is connected yet)
 * so public pool data can be inspected immediately.
 */
export function useFreightDelay(): FreightDelayContext {
  const { connection } = useConnection();
  const wallet = useWallet();

  const mint = useMemo(() => usdcMint(), []);
  const configPda = useMemo(() => (mint ? poolConfigPda(mint)[0] : null), [mint]);
  const treasury = useMemo(() => (configPda ? treasuryPda(configPda)[0] : null), [configPda]);

  const program = useMemo(() => {
    if (wallet.connected && wallet.publicKey) {
      return getProgram(connection, wallet as unknown as Wallet);
    }
    return getReadOnlyProgram(connection);
  }, [connection, wallet]);

  return {
    program,
    isWalletConnected: wallet.connected,
    publicKey: wallet.publicKey,
    configPda,
    treasuryPda: treasury,
    mint,
  };
}
