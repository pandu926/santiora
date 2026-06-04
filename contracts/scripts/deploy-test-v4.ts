import { ethers } from "hardhat";

const POLL = 5000;
const MAX = 300_000;
function ts() { return new Date().toISOString().slice(11, 19); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`[${ts()}] Deployer: ${deployer.address}`);
  console.log(`[${ts()}] Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} STT`);

  console.log(`\n[${ts()}] 1. Deploy MarketRegistryV2...`);
  const RegF = await ethers.getContractFactory("MarketRegistryV2");
  const reg = await RegF.deploy({ gasLimit: 30_000_000n });
  await reg.waitForDeployment();
  const regAddr = await reg.getAddress();
  console.log(`[${ts()}]    Registry: ${regAddr}`);

  console.log(`\n[${ts()}] 2. Deploy SantioraV4...`);
  const V4F = await ethers.getContractFactory("SantioraV4");
  const v4 = await V4F.deploy(regAddr, { gasLimit: 200_000_000n });
  await v4.waitForDeployment();
  const v4Addr = await v4.getAddress();
  console.log(`[${ts()}]    SantioraV4: ${v4Addr}`);

  console.log(`\n[${ts()}] 3. Wire registry...`);
  await (await (reg as any).addRegistrar(v4Addr, { gasLimit: 500_000n })).wait();

  console.log(`\n[${ts()}] 4. Fund 5 STT...`);
  await (await deployer.sendTransaction({ to: v4Addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();

  const [canCreate, reason] = await (v4 as any)["canCreateMarket(string)"]("sports");
  console.log(`\n[${ts()}] canCreate: ${canCreate} - ${reason}`);
  if (!canCreate && reason === "interval") {
    const r = await (v4 as any).rules();
    await (await (v4 as any).updateRules({
      scanInterval: 0n, minMarketDuration: r[1], maxMarketDuration: r[2],
      maxMarketsPerDay: r[3], confidenceThreshold: r[4], maxRounds: r[5]
    }, { gasLimit: 300_000n })).wait();
  }

  console.log(`\n[${ts()}] createMarket("sports")...`);
  const tx = await (v4 as any)["createMarket(string)"]("sports", { gasLimit: 200_000_000n });
  const receipt = await tx.wait();
  console.log(`[${ts()}]    tx: ${tx.hash}  block: ${receipt.blockNumber}\n`);

  const iface = (v4 as any).interface;
  const t0 = Date.now();
  let lastBlock = receipt.blockNumber;
  let done = false;

  while (!done && Date.now() - t0 < MAX) {
    await sleep(POLL);
    const cur = await ethers.provider.getBlockNumber();
    if (cur <= lastBlock) continue;
    let logs: any[] = [];
    try {
      logs = await ethers.provider.send("eth_getLogs", [{
        fromBlock: "0x" + (lastBlock + 1).toString(16),
        toBlock: "0x" + cur.toString(16),
        address: v4Addr,
      }]);
    } catch { lastBlock = cur; continue; }
    lastBlock = cur;

    for (const log of logs) {
      let p: any = null;
      try { p = iface.parseLog({ topics: log.topics, data: log.data }); } catch {}
      if (!p) continue;
      const e = `+${Math.round((Date.now() - t0) / 1000)}s`;
      const a = p.args.map((x: any) => typeof x === "bigint" ? x.toString() : x);
      if (p.name === "DataGathered")  console.log(`[${ts()}] ${e}  DATA   r${a[1]} [${a[2]}] ${a[4]}ch`);
      if (p.name === "DataFeedback")  console.log(`[${ts()}] ${e}  FEEDBK r${a[1]} ${a[2]}`);
      if (p.name === "VoteResult")    console.log(`[${ts()}] ${e}  VOTE   r${a[1]} yes=${a[2]} no=${a[3]} -> ${a[4]}`);
      if (p.name === "ResearchLoop")  console.log(`[${ts()}] ${e}  LOOP   r${a[1]}: ${a[2]}`);
      if (p.name === "MarketActive")  { console.log(`[${ts()}] ${e}  ACTIVE "${a[1]}" odds=${a[2]}`); done = true; }
      if (p.name === "PipelineFailed"){ console.log(`[${ts()}] ${e}  FAILED ${a[1]}`); done = true; }
      if (p.name === "Decision")      console.log(`[${ts()}] ${e}  DECISION ${a[1]}: ${String(a[2]).slice(0,120)}`);
    }
  }

  if (!done) console.log(`\ntimeout`);

  const count = Number(await (v4 as any).getMarketCount());
  if (count > 0) {
    const m = await (v4 as any).getMarket(0);
    console.log(`\n=== Market #0 ===`);
    console.log(`  status  : ${["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])]}`);
    console.log(`  question: ${m[0] || "(empty)"}`);
    console.log(`  odds    : ${m[1]}`);
    console.log(`  data    : ${String(m[7]).slice(0,200)}`);
  }

  console.log(`\nV4: ${v4Addr}  |  Registry: ${regAddr}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(v4Addr))} STT`);

  // Withdraw remaining
  try { await (await (v4 as any).withdraw(await ethers.provider.getBalance(v4Addr) - ethers.parseEther("0.1"), { gasLimit: 100_000n })).wait(); } catch {}
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
