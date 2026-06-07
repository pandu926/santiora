/**
 * mint-susd-bots.ts — mint 2000 SUSD to each bot wallet
 * npx hardhat run scripts/mint-susd-bots.ts --network somnia
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const SUSD_ADDR    = "0xB553c0003C3F0419abD358A2edD16191fC86ef90";
const MNEMONIC_FILE = path.join(__dirname, "../.bot-mnemonic");
const BOT_COUNT     = 5;
const MINT_AMOUNT   = ethers.parseEther("2000");

const SUSD_ABI = [
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const mnemonic   = fs.readFileSync(MNEMONIC_FILE, "utf8").trim();
  const susd       = new ethers.Contract(SUSD_ADDR, SUSD_ABI, deployer);

  console.log("Deployer:", deployer.address);

  for (let i = 0; i < BOT_COUNT; i++) {
    const bot = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    const bal: bigint = await susd.balanceOf(bot.address);

    if (bal >= MINT_AMOUNT) {
      console.log(`Bot${i + 1} ${bot.address}: already has ${ethers.formatEther(bal)} SUSD`);
      continue;
    }

    const needed = MINT_AMOUNT - bal;
    console.log(`Bot${i + 1} ${bot.address}: minting ${ethers.formatEther(needed)} SUSD...`);
    const tx = await susd.mint(bot.address, needed);
    await tx.wait();
    console.log(`  ✓ tx: ${tx.hash}`);
  }

  console.log("\nBalances:");
  for (let i = 0; i < BOT_COUNT; i++) {
    const bot = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    const bal: bigint = await susd.balanceOf(bot.address);
    console.log(`  Bot${i + 1}: ${ethers.formatEther(bal)} SUSD`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
