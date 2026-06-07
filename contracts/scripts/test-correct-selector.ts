import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
  const LLM_AGENT_ID = 12847293847561029384n;

  const platformAbi = [
    "function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes calldata payload) external payable returns (uint256 requestId)",
    "function getRequestDeposit() external view returns (uint256)",
    "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  ];
  const platform = new ethers.Contract(PLATFORM, platformAbi, deployer);

  // Correct signature: inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)
  // Selector: 0xd0683905
  const iface = new ethers.Interface([
    "function inferToolsChat(string[] roles, string[] messages, string[] mcpServerUrls, tuple(string, string)[] onchainTools, uint256 maxIterations, bool chainOfThought)"
  ]);

  const payload = iface.encodeFunctionData("inferToolsChat", [
    ["system", "user"],
    ["You are Santiora AI. Today is May 31, 2026. Return only valid JSON.", 'Create a YES/NO prediction market about sports June 1-7, 2026. Return: {"question":"...","odds":50,"category":"sports"}'],
    [], // mcpServerUrls
    [], // onchainTools - empty (string,string)[]
    0,  // maxIterations (0 like in the TX)
    false // chainOfThought (false like in the TX)
  ]);

  console.log("Selector:", payload.slice(0, 10));
  console.log("Expected: 0xd0683905");
  console.log("Match:", payload.slice(0, 10) === "0xd0683905");

  // Deposit: 0.03 + 0.1*3 = 0.33 STT
  const reserve = await platform.getRequestDeposit();
  const PER_AGENT = ethers.parseEther("0.1");
  const deposit = reserve + PER_AGENT * 3n;
  console.log("\nDeposit:", ethers.formatEther(deposit), "STT");

  // Send
  console.log("\nSending inferToolsChat with correct selector...");
  const tx = await platform.createRequest(
    LLM_AGENT_ID,
    ethers.ZeroAddress,
    "0x00000000",
    payload,
    { value: deposit, gasLimit: 50_000_000n }
  );
  const receipt = await tx.wait();
  console.log("TX:", tx.hash);
  console.log("Status:", receipt!.status === 1 ? "success" : "failed");
  console.log("Gas:", receipt!.gasUsed.toString());

  // Extract requestId
  let requestId: bigint | undefined;
  for (const log of receipt!.logs) {
    try {
      const parsed = platform.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "RequestCreated") {
        requestId = parsed.args[0];
        console.log("\nRequest ID:", requestId!.toString());
        console.log("perAgentBudget:", ethers.formatEther(parsed.args[2]), "STT");
      }
    } catch {}
  }

  if (!requestId) { console.log("No RequestCreated event"); return; }

  // Poll using getLogs for RequestFinalized
  console.log("\nWaiting for RequestFinalized (max 90s)...");
  const startBlock = receipt!.blockNumber;
  const startTime = Date.now();

  while (Date.now() - startTime < 90_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const currentBlock = await ethers.provider.getBlockNumber();

    const filter = {
      address: PLATFORM,
      topics: [
        ethers.id("RequestFinalized(uint256,uint8)"),
        ethers.zeroPadValue(ethers.toBeHex(requestId), 32)
      ],
      fromBlock: startBlock,
      toBlock: currentBlock,
    };

    const logs = await ethers.provider.getLogs(filter);
    if (logs.length > 0) {
      const status = parseInt(logs[0].data.slice(0, 66), 16);
      const statusName = ["None","Pending","Success","Failed","TimedOut"][status];
      console.log(`\n[${elapsed}s] RequestFinalized! Status: ${statusName} (${status})`);

      if (status === 2) {
        console.log("\n=== SUCCESS! inferToolsChat WORKS! ===");
        // Try to read response at block before finalize
        const finalBlock = logs[0].blockNumber;
        console.log("Finalized at block:", finalBlock);
      } else {
        console.log("\nFailed. Checking error...");
        // Read at block before finalize
        const finalBlock = logs[0].blockNumber;
        try {
          const getReqAbi = ["function getRequest(uint256 requestId) external view returns (tuple(uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, tuple(address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget))"];
          const reader = new ethers.Contract(PLATFORM, getReqAbi, deployer);
          const req = await reader.getRequest(requestId, { blockTag: finalBlock - 1 });
          if (req.responses && req.responses.length > 0) {
            const result = req.responses[0].result;
            const str = Buffer.from(result.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
            console.log("Error from validator:", str);
          }
        } catch (e: any) {
          console.log("Could not read error:", e.message?.slice(0, 100));
        }
      }
      return;
    }
    console.log(`[${elapsed}s] waiting...`);
  }
  console.log("\nTimeout.");
}

main().catch(console.error);
