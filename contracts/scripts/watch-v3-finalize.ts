import { ethers } from "hardhat";

const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const CREATOR = "0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F";
const MARKET_ID = 1;

async function main(): Promise<void> {
  const coord = await ethers.getContractAt("SantioraFinalV3", COORD);

  console.log("Polling market #0 for 5 minutes (every 15s)...");
  const start = Date.now();
  const TIMEOUT_MS = 5 * 60 * 1000;

  while (Date.now() - start < TIMEOUT_MS) {
    const mk = await (coord as any).getMarket(MARKET_ID);
    const status = Number(mk[4]);
    const statusName = ["Creating","Active","Resolving","Resolved","Failed"][status] ?? "?";
    const creatorBal = ethers.formatEther(await ethers.provider.getBalance(CREATOR));
    const elapsedSec = Math.round((Date.now() - start) / 1000);
    console.log(`[${elapsedSec}s] status=${statusName} q="${mk[0].slice(0,80)}" odds=${mk[1]} deadline=${mk[2]} creatorBal=${creatorBal}`);

    if (status === 1) {
      console.log("\n=== MARKET ACTIVE — autonomous pipeline PROVEN ===");
      console.log("question:", mk[0]);
      console.log("odds:    ", mk[1].toString());
      console.log("deadline:", new Date(Number(mk[2]) * 1000).toISOString());
      console.log("category:", mk[3]);
      console.log("data:    ", mk[7]);
      return;
    }
    if (status === 4) {
      console.log("\n=== MARKET FAILED ===");
      return;
    }
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log("\nTimeout — still Creating. Async LLM callback may be delayed.");
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
