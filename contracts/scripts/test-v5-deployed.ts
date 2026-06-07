import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const v5Addr = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";
  const abi = [
    "function marketCount() view returns (uint256)",
    "function markets(uint256) view returns (string question, uint256 odds, uint256 deadline, string category, uint8 status, string outcome, uint256 confidence, uint256 createdAt, string sourceUrl, string rawResponse)",
    "function getPipeline(uint256) view returns (uint8 phase, uint8 iteration, uint8 totalPending, uint8 completed)",
    "function getStats() view returns (tuple(uint256 totalCreated, uint256 totalResolved, uint256 totalFailed, uint256 totalRejected))",
    "function getCategories() view returns (string[])",
    "function rules() view returns (uint256 balanceMinimum, uint256 confidenceThreshold)",
    "function owner() view returns (address)",
    "function createMarket(string category)",
    "function forceResolve(uint256 marketId)",
    "function withdraw(uint256 amount)"
  ];

  const v5 = new ethers.Contract(v5Addr, abi, signer);

  // Check existing state
  const count = Number(await v5.marketCount());
  console.log(`\nExisting markets: ${count}`);

  for (let i = 0; i < count; i++) {
    const m = await v5.markets(i);
    const p = await v5.getPipeline(i);
    const statusMap: Record<number, string> = { 0: "Creating", 1: "Active", 2: "Resolving", 3: "Resolved", 4: "Failed" };
    console.log(`\n  [${i}] ${statusMap[Number(m.status)]} | phase=${p.phase} iter=${p.iteration}`);
    console.log(`      Question: ${m.question.slice(0, 120)}`);
    console.log(`      Odds: ${m.odds} | Confidence: ${m.confidence}`);
    console.log(`      Outcome: ${m.outcome || "(none)"}`);
    console.log(`      SourceUrl: ${m.sourceUrl.slice(0, 80)}`);
  }

  // Stats
  const stats = await v5.getStats();
  console.log(`\nStats: created=${stats.totalCreated} resolved=${stats.totalResolved} failed=${stats.totalFailed} rejected=${stats.totalRejected}`);

  // Categories
  const cats = await v5.getCategories();
  console.log(`Categories: ${cats.join(", ")}`);

  // Rules
  const r = await v5.rules();
  console.log(`Rules: balanceMin=${ethers.formatEther(r.balanceMinimum)} STT, confidenceThreshold=${r.confidenceThreshold}`);

  // Contract balance
  const bal = await signer.provider.getBalance(v5Addr);
  console.log(`Contract balance: ${ethers.formatEther(bal)} STT`);

  // Now create a sports market on the existing deployment
  console.log("\n" + "=".repeat(50));
  console.log("CREATING SPORTS MARKET...");
  console.log("=".repeat(50));

  const tx = await v5.createMarket("sports", { gasLimit: 200_000_000n });
  await tx.wait();
  console.log("Submitted. Polling...\n");

  const newId = count; // next market ID
  await pollUntilDone(v5, newId, 180_000);

  const mNew = await v5.markets(newId);
  const statusMap: Record<number, string> = { 0: "Creating", 1: "Active", 2: "Resolving", 3: "Resolved", 4: "Failed" };
  console.log(`\nSports market result:`);
  console.log(`  Status: ${statusMap[Number(mNew.status)]}`);
  console.log(`  Question: ${mNew.question}`);
  console.log(`  Odds: ${mNew.odds}`);
  console.log(`  Deadline: ${new Date(Number(mNew.deadline) * 1000).toISOString().slice(0, 10)}`);
  console.log(`  SourceUrl: ${mNew.sourceUrl}`);

  // Final stats
  const stats2 = await v5.getStats();
  console.log(`\nFinal stats: created=${stats2.totalCreated} resolved=${stats2.totalResolved} failed=${stats2.totalFailed} rejected=${stats2.totalRejected}`);
}

async function pollUntilDone(contract: any, marketId: number, maxMs: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await contract.getPipeline(marketId);
    if (Number(p.phase) === 4) return;
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 10_000));
  }
  console.log("(timeout)");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
