import {
  BaseSignerWalletAdapter,
  WalletName,
  WalletReadyState,
  WalletNotConnectedError,
  WalletConnectionError,
} from "@solana/wallet-adapter-base";
import { Keypair, VersionedTransaction, type Transaction } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";

const CLI_WALLET_NAME = "Solana CLI Keypair" as WalletName<"Solana CLI Keypair">;
const STORAGE_KEY = "trana_cli_keypair";

export class SolanaCliWalletAdapter extends BaseSignerWalletAdapter {
  name = CLI_WALLET_NAME;
  url = "https://docs.solanalabs.com/cli";
  icon =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
        <rect width="24" height="24" rx="5" fill="#0f172a" stroke="#2470ff" stroke-width="1.5"/>
        <path d="M6 8l4 4-4 4" fill="none" stroke="#5792ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 16h6" fill="none" stroke="#2470ff" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `);
  supportedTransactionVersions = new Set(["legacy", 0] as const);

  private _keypair: Keypair | null = null;
  private _connecting = false;

  constructor() {
    super();
    // Auto-load if keypair was saved in this session
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          this._keypair = parseKeypairInput(saved);
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get publicKey() {
    return this._keypair ? this._keypair.publicKey : null;
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Loadable;
  }

  async connect(): Promise<void> {
    if (this._keypair) {
      this.emit("connect", this._keypair.publicKey);
      return;
    }

    this._connecting = true;
    try {
      const input = window.prompt(
        "Connect Solana CLI Keypair\n\n" +
          "Paste your private key (either the JSON array [1,2,3...] from ~/.config/solana/id.json or a Base58 string):\n\n" +
          "(Tip: Run 'bun run wallet:export' in terminal to get your Base58 string)",
      );

      if (!input || !input.trim()) {
        throw new Error("No private key entered");
      }

      const keypair = parseKeypairInput(input.trim());
      this._keypair = keypair;
      sessionStorage.setItem(STORAGE_KEY, input.trim());
      this.emit("connect", keypair.publicKey);
    } catch (err) {
      const walletError = new WalletConnectionError(
        err instanceof Error ? err.message : String(err),
      );
      this.emit("error", walletError);
      throw walletError;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this._keypair = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._keypair) {
      throw new WalletNotConnectedError();
    }

    if (transaction instanceof VersionedTransaction) {
      transaction.sign([this._keypair]);
    } else {
      transaction.partialSign(this._keypair);
    }

    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]> {
    for (const tx of transactions) {
      await this.signTransaction(tx);
    }
    return transactions;
  }
}

function parseKeypairInput(input: string): Keypair {
  const trimmed = input.trim();

  // Case 1: JSON array e.g. [123, 45, 67, ...] from id.json
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const arr = JSON.parse(trimmed) as number[];
    const bytes = Uint8Array.from(arr);
    if (bytes.length === 64) {
      return Keypair.fromSecretKey(bytes);
    }
    if (bytes.length === 32) {
      return Keypair.fromSeed(bytes);
    }
    throw new Error(`Invalid JSON byte array length: ${bytes.length} (expected 64 or 32)`);
  }

  // Case 2: Base58 encoded string
  try {
    const bytes = utils.bytes.bs58.decode(trimmed);
    if (bytes.length === 64) {
      return Keypair.fromSecretKey(bytes);
    }
    if (bytes.length === 32) {
      return Keypair.fromSeed(bytes);
    }
    throw new Error(`Invalid Base58 key length: ${bytes.length} bytes (expected 64 or 32)`);
  } catch (err) {
    throw new Error(
      `Could not decode private key: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
