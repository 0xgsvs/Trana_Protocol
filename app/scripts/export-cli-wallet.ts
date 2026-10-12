import fs from "fs";
import path from "path";
import os from "os";
import { Keypair } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";

function main() {
  const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const keyPath = process.argv[2] || defaultPath;

  if (!fs.existsSync(keyPath)) {
    console.error(`\n❌ Keypair file not found at: ${keyPath}`);
    console.error("Tip: Run 'solana-keygen new' or specify the path to your keypair:");
    console.error("     bun run scripts/export-cli-wallet.ts /path/to/keypair.json\n");
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(keyPath, "utf-8");
    const secretKeyArray = JSON.parse(raw);
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    const base58Key = utils.bytes.bs58.encode(keypair.secretKey);

    console.log("\n=======================================================");
    console.log("       TRANA PROTOCOL — SOLANA CLI WALLET EXPORT       ");
    console.log("=======================================================");
    console.log(`📁 Keypair File: ${keyPath}`);
    console.log(`🔑 Public Address: ${keypair.publicKey.toBase58()}`);
    console.log(`\n🔐 Base58 Private Key:`);
    console.log(`   ${base58Key}`);
    console.log("\n-------------------------------------------------------");
    console.log("HOW TO CONNECT TO THE FRONTEND:");
    console.log("-------------------------------------------------------");
    console.log("OPTION 1: Direct in Frontend (No Extension Needed)");
    console.log("  1. In the Trana web app, click 'Select Wallet'");
    console.log("  2. Choose 'Solana CLI Keypair'");
    console.log("  3. Paste the Base58 private key above (or the JSON array)");
    console.log("");
    console.log("OPTION 2: Import into MetaMask (using Solana Snap)");
    console.log("  1. In MetaMask, install the Solana Snap from snaps.metamask.io");
    console.log("  2. In your Solana Snap settings, import your private key");
    console.log("  3. Click 'Select Wallet' on Trana -> Select MetaMask");
    console.log("");
    console.log("OPTION 3: Import into Phantom / Solflare");
    console.log("  1. In Phantom/Solflare: Settings -> Manage Accounts -> Add / Connect Wallet");
    console.log("  2. Choose 'Import Private Key'");
    console.log("  3. Paste the Base58 private key above and click Import");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ Failed to parse keypair:", err);
    process.exit(1);
  }
}

main();
