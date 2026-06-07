import { ethers } from "hardhat";

const COORD   = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const CREATOR = "0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F"; // on-chain creatorModule (verified)
const POLL_MS = 4_000;
const MAX_WAIT = 5 * 60_000;

function ts() { return new Date().toISOString().slice(11, 19); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const coord   = await ethers.getContractAt("SantioraFinalV3",  COORD);
  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);

  const creatorBal = await ethers.provider.getBalance(CREATOR);
  const minNeeded  = await (creator as any).minBalanceForCreate();
  console.log(`creator bal : ${ethers.formatEther(creatorBal)} STT (need ${ethers.formatEther(minNeeded)})`);
  if (creatorBal < minNeeded) { console.log("✗ underfunded"); return; }

  let [canCreate, reason] = await (coord as any)["canCreateMarket(string)"]("sports");
  console.log(`canCreate(sports): ${canCreate} — ${reason}`);
  const origRules = await (coord as any).rules();
  if (!canCreate && (reason === "interval" || reason === "daily_limit")) {
    // Relax interval→0 dan maxMarketsPerDay→999 supaya guard lewat untuk test
    await (await (coord as any).updateRules(
      { scanInterval: 0n, maxMarketDuration: origRules[1], minMarketDuration: origRules[2], maxMarketsPerDay: 999n },
      { gasLimit: 300_000n }
    )).wait();
    console.log("rules relaxed → scanInterval=0, maxMarketsPerDay=999");
    [canCreate, reason] = await (coord as any)["canCreateMarket(string)"]("sports");
    console.log(`re-check canCreate(sports): ${canCreate} — ${reason}`);
  }
  if (!canCreate) {
    console.log(`cannot create: ${reason}`);
    // restore sebelum keluar
    await (await (coord as any).updateRules(
      { scanInterval: origRules[0], maxMarketDuration: origRules[1], minMarketDuration: origRules[2], maxMarketsPerDay: origRules[3] },
      { gasLimit: 300_000n }
    )).wait();
    return;
  }

  const marketId = BigInt(await (coord as any).getMarketCount());
  console.log(`\n→ createMarket("sports")  expecting marketId=${marketId}`);
  const tx = await (coord as any)["createMarket(string)"]("sports", { gasLimit: 8_000_000n });
  const receipt = await tx.wait();
  console.log(`tx: ${tx.hash}  block: ${receipt.blockNumber}\n`);

  const coordIface   = (coord as any).interface;
  const creatorIface = (creator as any).interface;

  // Parse logs dari tx awal (best-effort — Somnia RPC kadang log.removed=null)
  console.log("Events di tx awal:");
  for (const log of receipt.logs) {
    try {
      let p: ethers.LogDescription | null = null;
      try { p = coordIface.parseLog(log); } catch {}
      if (!p) try { p = creatorIface.parseLog(log); } catch {}
      if (p) {
        const args = p.args.map((a: unknown) => typeof a === "bigint" ? a.toString() : a);
        console.log(`  ${p.name}`, args.slice(0, 4));
      }
    } catch { /* skip unparseable */ }
  }
  console.log();

  const t0 = Date.now();
  let lastBlock = receipt.blockNumber;
  let done = false;

  while (!done && Date.now() - t0 < MAX_WAIT) {
    await sleep(POLL_MS);
    const cur = await ethers.provider.getBlockNumber();
    if (cur <= lastBlock) continue;

    // Raw eth_getLogs — hindari ethers v6 normalisasi (Somnia RPC kirim removed:null)
    let rawLogs: Array<{ address: string; topics: string[]; data: string }> = [];
    try {
      rawLogs = await ethers.provider.send("eth_getLogs", [{
        fromBlock: "0x" + (lastBlock + 1).toString(16),
        toBlock:   "0x" + cur.toString(16),
        address:   [COORD, CREATOR],
      }]);
    } catch { lastBlock = cur; continue; }
    lastBlock = cur;

    for (const log of rawLogs) {
      let p: ethers.LogDescription | null = null;
      try { p = coordIface.parseLog({ topics: log.topics, data: log.data }); } catch {}
      if (!p) try { p = creatorIface.parseLog({ topics: log.topics, data: log.data }); } catch {}
      if (!p) continue;

      const mid = p.args[0]?.toString();
      if (mid !== undefined && mid !== marketId.toString()) continue;

      const elapsed = `+${((Date.now()-t0)/1000).toFixed(1)}s`;
      const args = p.args.map((a: unknown) => typeof a === "bigint" ? a.toString() : a);
      console.log(`[${ts()}] ${elapsed}  ${p.name}`);
      if (p.name === "CreatorStarted") console.log(`  url: ${args[2]}`);
      if (p.name === "CreatorData")    console.log(`  data: "${args[1]}"`);
      if (p.name === "CreatorBrain")   console.log(`  llm: ${String(args[1]).slice(0, 200)}`);
      if (p.name === "CreatorQuality") console.log(`  approved: ${args[1]}\n  response: ${String(args[2]).slice(0, 200)}`);
      if (p.name === "MarketActive")   { console.log(`  question: ${args[1]}\n  odds: ${args[2]}`); done = true; }
      if (p.name === "CreatorFailed" || p.name === "PipelineFailed") {
        console.log(`  reason: ${args[1]}`); done = true;
      }
    }
  }

  if (!done) console.log("\n⏱  timeout — pipeline masih jalan atau stuck");

  const m = await (coord as any).getMarket(marketId);
  const statusStr = ["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])];
  console.log(`\nMarket #${marketId}: ${statusStr}`);
  console.log(`  question : ${m[0] || "(empty)"}`);
  console.log(`  data     : ${m[7] || "(none)"}`);
  const balAfter = await ethers.provider.getBalance(CREATOR);
  console.log(`\ncreator spent: ${ethers.formatEther(creatorBal - balAfter)} STT`);

  const r = await (coord as any).rules();
  if (Number(r[0]) !== Number(origRules[0]) || Number(r[3]) !== Number(origRules[3])) {
    await (await (coord as any).updateRules(
      { scanInterval: origRules[0], maxMarketDuration: origRules[1], minMarketDuration: origRules[2], maxMarketsPerDay: origRules[3] },
      { gasLimit: 300_000n }
    )).wait();
    console.log(`rules restored → scanInterval=${origRules[0]}, maxMarketsPerDay=${origRules[3]}`);
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
