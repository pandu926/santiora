/**
 * bot-trader.ts — 5 autonomous bot wallets betting on V5 markets
 *
 * Usage:
 *   ts-node scripts/bot-trader.ts --setup   # fund bots with STT (one-time)
 *   ts-node scripts/bot-trader.ts           # run trading loop
 *
 * Env: PRIVATE_KEY (or WALLET_PRIVATE_KEY) = deployer key
 *      BOT_MNEMONIC = 12-word mnemonic for bots (auto-generated if missing)
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") }); // fallback

// ─── Config ─────────────────────────────────────────────────────────────────
const RPC           = process.env.SOMNIA_RPC || "https://dream-rpc.somnia.network";
const DEPLOYER_PK   = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const MNEMONIC_FILE = path.join(__dirname, "../.bot-mnemonic");

const SANTIORA_V5     = "0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8";
const V5_BETTING_POOL = "0x5303c2ba485625DC9eE5A55c6f5e17B2Cf7426C3";
const SUSD_ADDR       = "0xB553c0003C3F0419abD358A2edD16191fC86ef90";
const FAUCET_ADDR     = "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1";

const BOT_COUNT        = 5;
const LOOP_MS          = 5 * 60 * 1000;   // 5 min
const BET_MIN          = ethers.parseEther("50");
const BET_MAX          = ethers.parseEther("200");
const STT_FUND         = ethers.parseEther("0.5"); // STT per bot for gas

// Market status from V5
const STATUS_ACTIVE    = 1;
const STATUS_RESOLVED  = 3;

// ─── ABIs ────────────────────────────────────────────────────────────────────
const SUSD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const POOL_ABI = [
  "function bet(uint256 marketId, bool isYes, uint256 amount)",
  "function claim(uint256 marketId)",
  "function getOdds(uint256 marketId) view returns (uint256 yesOdds, uint256 noOdds)",
  "function getPosition(uint256 marketId, address user) view returns (uint256 yes, uint256 no)",
  "function claimed(uint256 marketId, address user) view returns (bool)",
];

const V5_ABI = [
  "function marketCount() view returns (uint256)",
  "function markets(uint256) view returns (string question, uint256 odds, uint256 deadline, string category, uint8 status, string outcome, uint256 confidence, uint256 createdAt, string sourceUrl, string rawResponse)",
];

const FAUCET_ABI = [
  "function claim()",
  "function canClaim(address) view returns (bool)",
];

// ─── Wallet setup ────────────────────────────────────────────────────────────
function getMnemonic(): string {
  const env = process.env.BOT_MNEMONIC;
  if (env) return env;
  if (fs.existsSync(MNEMONIC_FILE)) return fs.readFileSync(MNEMONIC_FILE, "utf8").trim();
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic!.phrase;
  fs.writeFileSync(MNEMONIC_FILE, mnemonic);
  console.log("[setup] Generated BOT_MNEMONIC and saved to", MNEMONIC_FILE);
  return mnemonic;
}

function getBotWallets(provider: ethers.JsonRpcProvider): ethers.HDNodeWallet[] {
  const mnemonic = getMnemonic();
  return Array.from({ length: BOT_COUNT }, (_, i) =>
    ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`).connect(provider)
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randBetween(min: bigint, max: bigint): bigint {
  const range = max - min;
  const rand = BigInt(Math.floor(Math.random() * Number(range / ethers.parseEther("1"))));
  return min + rand * ethers.parseEther("1");
}

function log(botIdx: number, msg: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] Bot${botIdx + 1}: ${msg}`);
}

// ─── One bot cycle ────────────────────────────────────────────────────────────
async function runBot(
  idx: number,
  wallet: ethers.HDNodeWallet,
  provider: ethers.JsonRpcProvider
) {
  const susd   = new ethers.Contract(SUSD_ADDR,       SUSD_ABI,   wallet);
  const pool   = new ethers.Contract(V5_BETTING_POOL, POOL_ABI,   wallet);
  const v5     = new ethers.Contract(SANTIORA_V5,     V5_ABI,     wallet);
  const faucet = new ethers.Contract(FAUCET_ADDR,     FAUCET_ABI, wallet);

  // Faucet uses different SUSD token — skip, bots funded via mint-susd-bots.ts
  // try {
  //   const canClaim = await faucet.canClaim(wallet.address);
  //   ...
  // } catch {}

  const susdBal: bigint = await susd.balanceOf(wallet.address);
  if (susdBal < BET_MIN) {
    log(idx, `SUSD balance too low (${ethers.formatEther(susdBal)}), skipping bets`);
    return;
  }

  // 2. Load active markets
  const totalMarkets: bigint = await v5.marketCount();
  const total = Number(totalMarkets);
  if (total === 0) return;

  const activeMarkets: { id: number; deadline: number; yesOdds: number }[] = [];
  for (let i = 0; i < total; i++) {
    try {
      const m = await v5.markets(i);
      const status   = Number(m[4]);
      const deadline = Number(m[2]);
      if (status === STATUS_ACTIVE && deadline > Math.floor(Date.now() / 1000)) {
        const [yesOdds] = await pool.getOdds(i);
        activeMarkets.push({ id: i, deadline, yesOdds: Number(yesOdds) });
      }
    } catch {}
  }

  // 3. Bet on markets where this bot has no position yet
  // Each bot randomly picks up to 3 markets per cycle
  const shuffled = activeMarkets.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const mkt of shuffled) {
    const [yesPos, noPos] = await pool.getPosition(mkt.id, wallet.address);
    if ((yesPos as bigint) > 0n || (noPos as bigint) > 0n) {
      log(idx, `Market ${mkt.id}: already bet, skipping`);
      continue;
    }

    const remaining: bigint = await susd.balanceOf(wallet.address);
    if (remaining < BET_MIN) break;

    // 60% bias toward current favorite
    const favoriteIsYes = mkt.yesOdds >= 50;
    const roll = Math.random();
    const betYes = favoriteIsYes ? roll < 0.6 : roll >= 0.6;

    const maxAllowed = remaining < BET_MAX ? remaining : BET_MAX;
    const amount = randBetween(BET_MIN, maxAllowed);

    try {
      // Approve if needed
      const allowance: bigint = await susd.allowance(wallet.address, V5_BETTING_POOL);
      if (allowance < amount) {
        log(idx, `Approving SUSD for pool...`);
        const approveTx = await susd.approve(V5_BETTING_POOL, ethers.MaxUint256, { gasLimit: 3_000_000 });
        await approveTx.wait();
      }

      const side = betYes ? "YES" : "NO";
      log(idx, `Market ${mkt.id}: betting ${ethers.formatEther(amount)} SUSD on ${side} (odds: YES${mkt.yesOdds}%)`);
      const betTx = await pool.bet(mkt.id, betYes, amount, { gasLimit: 10_000_000 });
      await betTx.wait();
      log(idx, `Market ${mkt.id}: bet confirmed ✓`);
    } catch (e: unknown) {
      log(idx, `Market ${mkt.id}: bet failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
    }
  }

  // 4. Claim winnings on resolved markets
  for (let i = 0; i < total; i++) {
    try {
      const m      = await v5.markets(i);
      const status = Number(m[4]);
      if (status < STATUS_RESOLVED) continue;

      const alreadyClaimed: boolean = await pool.claimed(i, wallet.address);
      if (alreadyClaimed) continue;

      const [yesPos, noPos] = await pool.getPosition(i, wallet.address);
      if ((yesPos as bigint) === 0n && (noPos as bigint) === 0n) continue;

      log(idx, `Market ${i}: claiming winnings...`);
      const claimTx = await pool.claim(i, { gasLimit: 3_000_000 });
      await claimTx.wait();
      const newBal: bigint = await susd.balanceOf(wallet.address);
      log(idx, `Market ${i}: claimed ✓ (balance now: ${ethers.formatEther(newBal)} SUSD)`);
    } catch (e: unknown) {
      log(idx, `Market ${i}: claim failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
    }
  }
}

// ─── Setup mode ──────────────────────────────────────────────────────────────
async function setupBots(provider: ethers.JsonRpcProvider) {
  if (!DEPLOYER_PK) throw new Error("PRIVATE_KEY env var not set");
  const deployer = new ethers.Wallet(DEPLOYER_PK, provider);
  const bots     = getBotWallets(provider);

  console.log("Deployer:", deployer.address);
  console.log("Bot wallets:");
  bots.forEach((b, i) => console.log(`  Bot${i + 1}: ${b.address}`));

  for (let i = 0; i < bots.length; i++) {
    const bot    = bots[i];
    const sttBal = await provider.getBalance(bot.address);
    if (sttBal >= STT_FUND) {
      console.log(`Bot${i + 1}: already funded (${ethers.formatEther(sttBal)} STT)`);
      continue;
    }
    const needed = STT_FUND - sttBal;
    console.log(`Bot${i + 1}: funding with ${ethers.formatEther(needed)} STT...`);
    const tx = await deployer.sendTransaction({
      to: bot.address,
      value: needed,
      gasLimit: 21_000,
      type: 0,
      gasPrice: ethers.parseUnits("6", "gwei"),
    });
    await tx.wait();
    console.log(`Bot${i + 1}: funded ✓ (${bot.address})`);
  }
  console.log("\nSetup complete. Run without --setup to start trading.");
}

// ─── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  const isSetup = process.argv.includes("--setup");
  const provider = new ethers.JsonRpcProvider(RPC);

  if (isSetup) {
    await setupBots(provider);
    return;
  }

  const bots = getBotWallets(provider);
  console.log("=== V5 Bot Trader Starting ===");
  bots.forEach((b, i) => console.log(`  Bot${i + 1}: ${b.address}`));
  console.log(`  Loop interval: ${LOOP_MS / 1000}s\n`);

  const runAll = async () => {
    console.log(`\n[${new Date().toLocaleTimeString()}] === New cycle ===`);
    await Promise.allSettled(bots.map((bot, idx) => runBot(idx, bot, provider)));
  };

  await runAll();
  setInterval(runAll, LOOP_MS);
}

main().catch(e => { console.error(e); process.exit(1); });
