import { ethers } from "hardhat";

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const CREATOR = process.env.CREATOR ?? "0x760aB47ED5990e1f52b513B0d9a858928341ACb9";
const COORDINATOR = process.env.COORDINATOR ?? "0x5F67658Fb59F5d2F482908AB3b59e0f2E585b71c";
const REGISTRY = process.env.REGISTRY ?? "0x00178E873eC7cCe37a1e1001166161449C1b47CA";
const CREATE_TX = process.env.CREATE_TX ?? "0x08591183d36f4655d7c6b508e0ab47ae12ba067a73a7e27d650e6e2e8f335004";

const requestCreatedTopic = ethers.id("RequestCreated(uint256,uint256,uint256,bytes,address[])");
const requestFinalizedTopic = ethers.id("RequestFinalized(uint256,uint8)");

interface RawLog {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
}

async function rawLogs(fromBlock: number, toBlock: number, topics: Array<string | null>): Promise<RawLog[]> {
  const rpc = process.env.SOMNIA_RPC ?? "https://dream-rpc.somnia.network";
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [{ fromBlock: ethers.toBeHex(fromBlock), toBlock: ethers.toBeHex(toBlock), address: PLATFORM, topics }],
    }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as RawLog[];
}

async function main(): Promise<void> {
  const receipt = await ethers.provider.getTransactionReceipt(CREATE_TX);
  if (!receipt) throw new Error("create tx receipt not found");

  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);
  const coordinator = await ethers.getContractAt("SantioraFinalV3", COORDINATOR);
  const registry = await ethers.getContractAt("MarketRegistryV2", REGISTRY);
  const current = await ethers.provider.getBlockNumber();

  console.log("Create block:", receipt.blockNumber);
  console.log("Current block:", current);

  const created = await rawLogs(receipt.blockNumber, Math.min(receipt.blockNumber + 900, current), [requestCreatedTopic]);
  const requestIds: bigint[] = [];
  for (const log of created) {
    const requestId = BigInt(log.topics[1]);
    requestIds.push(requestId);
    console.log("RequestCreated:", requestId.toString(), "tx", log.transactionHash);
  }

  for (const requestId of requestIds) {
    const topicRequestId = ethers.zeroPadValue(ethers.toBeHex(requestId), 32);
    const finalized = await rawLogs(receipt.blockNumber, current, [requestFinalizedTopic, topicRequestId]);
    console.log("Request", requestId.toString(), "finalized logs", finalized.length);
    for (const log of finalized) {
      const status = Number(BigInt(log.data));
      console.log("  finalized status", status, "block", Number(log.blockNumber), "tx", log.transactionHash);
    }
    console.log("  exists", await creator.requestExists(requestId));
    console.log("  type", (await creator.requestType(requestId)).toString());
    console.log("  market", (await creator.requestToMarket(requestId)).toString());
  }

  const market = await coordinator.getMarket(0);
  const stats = await coordinator.getStats();
  console.log("Market status:", market[4].toString());
  console.log("Question:", market[0]);
  console.log("Data:", market[7]);
  console.log("Stats:", stats.map((value: bigint) => value.toString()).join(","));
  console.log("Registry count:", (await registry.getMarketCount()).toString());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
