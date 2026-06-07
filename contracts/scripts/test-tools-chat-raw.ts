import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
  const LLM_AGENT_ID = 12847293847561029384n;
  const DEPOSIT = ethers.parseEther("0.24");

  const platformAbi = [
    "function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes calldata payload) external payable returns (uint256 requestId)",
    "function getRequest(uint256 requestId) external view returns (tuple(uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, tuple(address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget))",
    "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  ];

  const platform = new ethers.Contract(PLATFORM, platformAbi, deployer);

  // Test 1: inferToolsChat with exact official signature
  // When onchainTools is empty tuple[], it encodes same as empty bytes[]
  // Use bytes[] for encoding compatibility

  const iface = new ethers.Interface([
    "function inferToolsChat(string[] roles, string[] messages, string[] mcpServerUrls, bytes[] onchainTools, uint256 maxIterations, bool chainOfThought)"
  ]);

  const payload = iface.encodeFunctionData("inferToolsChat", [
    ["system", "user"],
    [
      "You are Santiora AI. Today is May 31, 2026. Return only valid JSON.",
      'Create a YES/NO prediction market about sports June 1-7, 2026. Return: {"question":"...","odds":50,"category":"sports"}'
    ],
    [], // mcpServerUrls
    [], // onchainTools (empty)
    1,  // maxIterations
    true // chainOfThought
  ]);

  console.log("\nPayload selector:", payload.slice(0, 10));
  console.log("Payload length:", payload.length);

  // Send directly to platform (no callback, just check if it works)
  console.log("\nTest 1: inferToolsChat with tuple[] signature...");
  try {
    const tx = await platform.createRequest(
      LLM_AGENT_ID,
      ethers.ZeroAddress,
      "0x00000000",
      payload,
      { value: DEPOSIT, gasLimit: 50_000_000n }
    );
    const receipt = await tx.wait();
    console.log("TX:", tx.hash);
    console.log("Gas:", receipt!.gasUsed.toString());

    // Extract request ID from logs
    for (const log of receipt!.logs) {
      try {
        const parsed = platform.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "RequestCreated") {
          console.log("Request ID:", parsed.args[0].toString());
          console.log("perAgentBudget:", ethers.formatEther(parsed.args[2]), "STT");
        }
      } catch {}
    }
  } catch (e: any) {
    console.log("FAILED:", e.message?.slice(0, 300));
  }

  // Test 2: Try inferChat (proven working) for comparison
  console.log("\n\nTest 2: inferChat (proven working) for comparison...");
  const ifaceChat = new ethers.Interface([
    "function inferChat(string[] roles, string[] messages, bool chainOfThought)"
  ]);
  const payloadChat = ifaceChat.encodeFunctionData("inferChat", [
    ["system", "user"],
    [
      "You are Santiora AI. Today is May 31, 2026.",
      'Create a prediction market. Return JSON: {"question":"Will BTC hit 80000 by June 7?","odds":35,"category":"crypto"}'
    ],
    true
  ]);
  console.log("inferChat selector:", payloadChat.slice(0, 10));

  try {
    const tx2 = await platform.createRequest(
      LLM_AGENT_ID,
      ethers.ZeroAddress,
      "0x00000000",
      payloadChat,
      { value: DEPOSIT, gasLimit: 50_000_000n }
    );
    const receipt2 = await tx2.wait();
    console.log("TX:", tx2.hash);
    console.log("Gas:", receipt2!.gasUsed.toString());
    for (const log of receipt2!.logs) {
      try {
        const parsed = platform.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "RequestCreated") {
          console.log("Request ID:", parsed.args[0].toString());
        }
      } catch {}
    }
  } catch (e: any) {
    console.log("FAILED:", e.message?.slice(0, 300));
  }

  // Wait and check both
  console.log("\n\nWaiting 30s then checking results...");
  await new Promise(r => setTimeout(r, 30000));

  // We can't easily poll without callback, but the test contract already proved
  // the callback mechanism works. The key question is whether inferToolsChat
  // returns Success or Failed.
  console.log("Done. Check explorer for TX results.");
}

main().catch(console.error);
