import { ethers } from "hardhat";

const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";

async function main() {
  const [signer] = await ethers.getSigners();

  const bal = await ethers.provider.getBalance(REACTIVE);
  console.log(`Reactive balance: ${ethers.formatEther(bal)} STT`);

  const reactive = new ethers.Contract(REACTIVE, [
    "function getStats() view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
    "function getNextFireEstimate() view returns (uint256,uint256,uint256)",
    "function createIntervalBlocks() view returns (uint64)",
    "function resolveIntervalBlocks() view returns (uint64)",
    "function createSubscriptionId() view returns (uint256)",
    "function resolveSubscriptionId() view returns (uint256)",
    "function v4() view returns (address)",
    "function owner() view returns (address)",
  ], signer);

  const [cf, rf, ar, mc, lcb, lrb] = await reactive.getStats();
  console.log(`\n=== ReactiveV4 Stats ===`);
  console.log(`  Target V4: ${await reactive.v4()}`);
  console.log(`  Owner: ${await reactive.owner()}`);
  console.log(`  Create fires: ${cf}`);
  console.log(`  Resolve fires: ${rf}`);
  console.log(`  Auto resolves: ${ar}`);
  console.log(`  Markets created: ${mc}`);
  console.log(`  Last create block: ${lcb}`);
  console.log(`  Last resolve block: ${lrb}`);
  console.log(`  Create interval: ${await reactive.createIntervalBlocks()} blocks`);
  console.log(`  Resolve interval: ${await reactive.resolveIntervalBlocks()} blocks`);
  console.log(`  Create sub ID: ${await reactive.createSubscriptionId()}`);
  console.log(`  Resolve sub ID: ${await reactive.resolveSubscriptionId()}`);

  const [blocksUntilCreate, blocksUntilResolve, currentBlock] = await reactive.getNextFireEstimate();
  console.log(`\n  Current block: ${currentBlock}`);
  console.log(`  Blocks until next create: ${blocksUntilCreate} (~${Math.round(Number(blocksUntilCreate) * 0.4)}s)`);
  console.log(`  Blocks until next resolve: ${blocksUntilResolve} (~${Math.round(Number(blocksUntilResolve) * 0.4)}s)`);

  // Recent logs
  const fromBlock = currentBlock - 50000;
  console.log(`\n=== Recent Events (last ~50K blocks) ===`);
  try {
    const logs = await ethers.provider.send("eth_getLogs", [{
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + currentBlock.toString(16),
      address: REACTIVE,
    }]);
    const iface = new ethers.Interface([
      "event CreateFired(uint256 blockNumber, uint256 timestamp, string category)",
      "event CreateSkipped(uint256 blockNumber, string reason)",
      "event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved)",
      "event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId)",
    ]);
    let count = 0;
    for (const log of logs.slice(-20)) {
      try {
        const p = iface.parseLog({ topics: log.topics, data: log.data });
        if (!p) continue;
        const blk = parseInt(log.blockNumber, 16);
        const args = p.args.map((x: any) => typeof x === "bigint" ? x.toString() : x);
        console.log(`  [${blk}] ${p.name}(${args.join(", ")})`);
        count++;
      } catch {}
    }
    if (count === 0) console.log("  (no events in range)");
    console.log(`  Total logs in range: ${logs.length}`);
  } catch (e: any) {
    console.log(`  Error fetching logs: ${e.message}`);
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
