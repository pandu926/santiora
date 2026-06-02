import { ethers } from "hardhat";

const COORDINATOR = "0x06d7308C8BC931737F5D448C9a755D84CE23773f";
const POLL_MS = 8_000;
const MAX_WAIT_MS = 240_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const coord = new ethers.Contract(COORDINATOR, [
    "function getMarket(uint256) view returns (string,uint256,uint256,string,uint8,uint256,string,string)",
    "function getStats() view returns (uint256,uint256,uint256,uint256,uint256)"
  ], ethers.provider);

  const start = Date.now();
  let last = "";
  while (Date.now() - start < MAX_WAIT_MS) {
    const elapsed = Math.round((Date.now() - start) / 1000);
    try {
      const m = await coord.getMarket(1);
      const status = Number(m[4]);
      const q = (m[0] as string).slice(0, 100);
      const odds = m[1].toString();
      const sig = `${status}|${q}|${odds}`;
      if (sig !== last) {
        console.log(`[${elapsed}s] status=${status} odds=${odds} q="${q}"`);
        last = sig;
      }
      if (status === 1 || status === 4) {
        console.log("\n=== FINAL ===");
        console.log("Question:", m[0]);
        console.log("Odds:", odds);
        console.log("Status:", status === 1 ? "Created" : "Failed");
        console.log("Data source:", m[6]);
        console.log("Data value:", m[7]);
        return;
      }
    } catch (e: unknown) {
      console.log(`[${elapsed}s] read err`);
    }
    await sleep(POLL_MS);
  }
  console.log("\nTIMEOUT");
}

main().catch((e) => { console.error(e); process.exit(1); });
