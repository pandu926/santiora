import { ethers } from "hardhat";

const COORDINATOR = "0x097794BcD357F95B24dBAf3Bfc91600C329B5dD8";
const CREATOR = "0xf878C9a6B2Ed9329De1B3Da2464Bc19Bf23709ab";
const REGISTRY = "0x43a73fe17806B08c489B6fFE606ab1919dDD3E8c";
const CREATE_TX = "0x1397e9a6f844c08e264c04db661665d5f328d6e28d6352b2f53986e5d8564920";

async function main(): Promise<void> {
  const coordinator = await ethers.getContractAt("SantioraFinalV3", COORDINATOR);
  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);
  const registry = await ethers.getContractAt("MarketRegistryV2", REGISTRY);

  const receipt = await ethers.provider.getTransactionReceipt(CREATE_TX);
  if (!receipt) throw new Error("receipt not found");
  console.log("Create block:", receipt.blockNumber, "logs:", receipt.logs.length);

  // Decode logs from create tx
  const coordIface = new ethers.Interface([
    "event MarketCreating(uint256 indexed marketId, string category)",
    "event PipelineFailed(uint256 indexed marketId, string reason)",
    "event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline)",
  ]);
  const creatorIface = new ethers.Interface([
    "event CreatorStarted(uint256 indexed marketId, string category, string sourceUrl)",
    "event CreatorData(uint256 indexed marketId, string data)",
    "event CreatorBrain(uint256 indexed marketId, string response)",
    "event CreatorQuality(uint256 indexed marketId, bool approved, string response)",
    "event CreatorFailed(uint256 indexed marketId, string reason)",
  ]);

  for (const log of receipt.logs) {
    for (const iface of [coordIface, creatorIface]) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed) console.log("Event:", parsed.name, parsed.args.toString());
      } catch {}
    }
  }

  // Now scan blocks after create for callback events
  const current = await ethers.provider.getBlockNumber();
  const rpc = process.env.SOMNIA_RPC ?? "https://dream-rpc.somnia.network";

  // Look for CreatorFailed and PipelineFailed in nearby blocks
  for (const eventSig of [
    "CreatorFailed(uint256,string)",
    "PipelineFailed(uint256,string)",
    "CreatorData(uint256,string)",
    "CreatorBrain(uint256,string)",
    "CreatorQuality(uint256,bool,string)",
    "MarketActive(uint256,string,uint256,uint256)",
  ]) {
    const topic = ethers.id(eventSig);
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_getLogs",
        params: [{ fromBlock: ethers.toBeHex(receipt.blockNumber), toBlock: ethers.toBeHex(Math.min(receipt.blockNumber + 900, current)), topics: [topic] }],
      }),
    });
    const json = await resp.json();
    const logs = json.result || [];
    if (logs.length > 0) {
      console.log(`\n${eventSig}: ${logs.length} logs`);
      for (const l of logs.slice(0, 5)) {
        console.log("  block", Number(l.blockNumber), "tx", l.transactionHash);
        console.log("  topics", l.topics);
        console.log("  data", l.data?.slice(0, 200));
      }
    }
  }

  // Check market state
  const market = await coordinator.getMarket(0);
  console.log("\nMarket status:", market[4].toString());
  console.log("Question:", market[0]);
  console.log("Data:", market[7]);

  // Check draft
  const draft = await creator.drafts(0);
  console.log("\nDraft marketId:", draft[0].toString());
  console.log("Draft category:", draft[1]);
  console.log("Draft sourceUrl:", draft[2]);
  console.log("Draft selector:", draft[3]);
  console.log("Draft data:", draft[4]);
  console.log("Draft retryCount:", draft[8].toString());

  // Check balances
  console.log("\nCreator balance:", ethers.formatEther(await ethers.provider.getBalance(CREATOR)));
  console.log("Coordinator balance:", ethers.formatEther(await ethers.provider.getBalance(COORDINATOR)));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
