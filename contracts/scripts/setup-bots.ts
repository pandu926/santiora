/**
 * setup-bots.ts — fund 5 bot wallets with STT via Hardhat runner
 * npx hardhat run scripts/setup-bots.ts --network somnia
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const MNEMONIC_FILE = path.join(__dirname, "../.bot-mnemonic");
const BOT_COUNT     = 5;
const STT_FUND      = ethers.parseEther("0.5");

function getMnemonic(): string {
  if (fs.existsSync(MNEMONIC_FILE)) return fs.readFileSync(MNEMONIC_FILE, "utf8").trim();
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic!.phrase;
  fs.writeFileSync(MNEMONIC_FILE, mnemonic);
  console.log("[setup] Generated BOT_MNEMONIC →", MNEMONIC_FILE);
  return mnemonic;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = deployer.provider!;
  const mnemonic   = getMnemonic();

  console.log("Deployer:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Deployer STT:", ethers.formatEther(balance));

  for (let i = 0; i < BOT_COUNT; i++) {
    const botWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    const botAddr   = botWallet.address;
    const botBal    = await provider.getBalance(botAddr);

    console.log(`\nBot${i + 1}: ${botAddr} (${ethers.formatEther(botBal)} STT)`);

    if (botBal >= STT_FUND) {
      console.log(`  already funded, skipping`);
      continue;
    }

    const needed = STT_FUND - botBal;
    console.log(`  funding with ${ethers.formatEther(needed)} STT...`);

    const tx = await deployer.sendTransaction({ to: botAddr, value: needed });
    await tx.wait();
    console.log(`  funded ✓  tx: ${tx.hash}`);
  }

  console.log("\n=== Setup complete ===");
  console.log("Bot wallets:");
  for (let i = 0; i < BOT_COUNT; i++) {
    const w = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    const b = await provider.getBalance(w.address);
    console.log(`  Bot${i + 1}: ${w.address}  ${ethers.formatEther(b)} STT`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
