import { ethers } from "hardhat";

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const COORDINATOR = "0x45Cf5E6E4da114F74B6beC2D14533736f31A0917";
const CREATOR = "0xe3BA72A30155434508d95F50927E0a96D1A67F59";
const REGISTRY = "0xC4c8fbA6CbB5d558e0894F8aF8aA96Bbe68b8AAe";
const CREATE_TX = "0x451bf1f8f4d142362a8bc13215518aee9952e52eda40771d4262fd97916d4ff7";

const requestAbi = [
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  "function getRequest(uint256 requestId) external view returns (tuple(uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, tuple(address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget))",
];

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const platform = new ethers.Contract(PLATFORM, requestAbi, signer);
  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);
  const coordinator = await ethers.getContractAt("SantioraFinalV3", COORDINATOR);
  const registry = await ethers.getContractAt("MarketRegistryV2", REGISTRY);

  const receipt = await ethers.provider.getTransactionReceipt(CREATE_TX);
  if (!receipt) throw new Error("create tx receipt not found");
  console.log("Create block:", receipt.blockNumber);

  const iface = new ethers.Interface(requestAbi);
  const currentBlock = await ethers.provider.getBlockNumber();
  const allLogs = [];
  for (let fromBlock = receipt.blockNumber; fromBlock <= currentBlock; fromBlock += 900) {
    const toBlock = Math.min(fromBlock + 899, currentBlock);
    const chunk = await ethers.provider.getLogs({
      address: PLATFORM,
      fromBlock,
      toBlock,
      topics: [ethers.id("RequestCreated(uint256,uint256,uint256,bytes,address[])")],
    });
    allLogs.push(...chunk);
  }
  const logs = allLogs;
  console.log("RequestCreated logs:", logs.length);

  const statusNames = ["None", "Pending", "Success", "Failed", "TimedOut"];
  for (const log of logs) {
    const parsed = iface.parseLog(log);
    if (!parsed) continue;
    const requestId = parsed.args.requestId as bigint;
    const agentId = parsed.args.agentId as bigint;
    const req = await platform.getRequest(requestId);
    if (req.callbackAddress.toLowerCase() !== CREATOR.toLowerCase()) continue;

    const exists = await creator.requestExists(requestId);
    const marketId = await creator.requestToMarket(requestId);
    const reqType = await creator.requestType(requestId);
    console.log("\nCreator request:", requestId.toString());
    console.log("  agent:", agentId.toString());
    console.log("  type:", reqType.toString(), "exists:", exists, "market:", marketId.toString());
    console.log("  platform status:", statusNames[Number(req.status)] ?? req.status.toString());
    console.log("  responseCount:", req.responseCount.toString(), "failureCount:", req.failureCount.toString());
    console.log("  callback:", req.callbackAddress, req.callbackSelector);
  }

  const market = await coordinator.getMarket(0);
  const stats = await coordinator.getStats();
  const regCount = await registry.getMarketCount();
  const creatorBalance = await ethers.provider.getBalance(CREATOR);
  console.log("\nCoordinator market0 status:", market[4].toString());
  console.log("Coordinator data:", market[7]);
  console.log("Stats:", stats.map((x: bigint) => x.toString()).join(", "));
  console.log("Registry count:", regCount.toString());
  console.log("Creator balance:", ethers.formatEther(creatorBalance), "STT");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
