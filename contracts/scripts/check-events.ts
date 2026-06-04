import { ethers } from "hardhat";

async function main() {
  const cur = await ethers.provider.getBlockNumber();
  console.log(`Current block: ${cur}`);

  const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";
  const V4 = "0xbc2455C2D2d75B70ee97AcDC87da11f6FEd301F3";
  const RANGE = 5000;

  let allReactive: any[] = [];
  let allV4: any[] = [];
  for (let start = cur - RANGE; start < cur; start += 999) {
    const end = Math.min(start + 998, cur);
    const [rLogs, vLogs] = await Promise.all([
      ethers.provider.send("eth_getLogs", [{ fromBlock: "0x"+start.toString(16), toBlock: "0x"+end.toString(16), address: REACTIVE }]),
      ethers.provider.send("eth_getLogs", [{ fromBlock: "0x"+start.toString(16), toBlock: "0x"+end.toString(16), address: V4 }]),
    ]);
    allReactive.push(...rLogs);
    allV4.push(...vLogs);
  }

  console.log(`\nReactive logs (last ${RANGE} blocks): ${allReactive.length}`);
  const iface = new ethers.Interface([
    "event CreateFired(uint256 blockNumber, uint256 timestamp, string category)",
    "event CreateSkipped(uint256 blockNumber, string reason)",
    "event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved)",
    "event ResolveSkipped(uint256 blockNumber, string reason)",
    "event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId)",
    "event LoopStarted(string jobType, uint64 intervalBlocks, uint256 subscriptionId)",
  ]);
  for (const l of allReactive.slice(-20)) {
    try {
      const p = iface.parseLog({ topics: l.topics, data: l.data });
      if (p) console.log(`  [${parseInt(l.blockNumber,16)}] ${p.name}(${p.args.map((x:any)=>typeof x==="bigint"?x.toString():x).join(", ")})`);
    } catch { console.log(`  [${parseInt(l.blockNumber,16)}] unknown topic ${(l.topics[0] as string)?.slice(0,10)}`); }
  }

  console.log(`\nV4 logs (last ${RANGE} blocks): ${allV4.length}`);
  for (const l of allV4.slice(-10)) {
    console.log(`  [${parseInt(l.blockNumber,16)}] topics=${l.topics.length} data=${(l.data as string).slice(0,40)}...`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
