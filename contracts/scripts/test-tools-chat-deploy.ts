import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy TestInferToolsChat
  console.log("\n1. Deploying TestInferToolsChat...");
  const Factory = await ethers.getContractFactory("TestInferToolsChat");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed at:", addr);

  // Fund with 1 STT
  console.log("\n2. Funding with 1 STT...");
  const fundTx = await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n });
  await fundTx.wait();
  console.log("   Funded");

  // Call testInferToolsChat
  console.log("\n3. Calling testInferToolsChat...");
  const tx = await contract.testInferToolsChat(
    'Create a YES/NO prediction market about a sports event June 1-7, 2026. Return JSON: {"question":"...","odds":50,"category":"sports"}',
    { gasLimit: 50_000_000n }
  );
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas used:", receipt!.gasUsed.toString());

  // Get requestId from event
  const requestSentEvent = receipt!.logs.find((log: any) => {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "RequestSent";
    } catch { return false; }
  });

  let requestId: bigint | undefined;
  if (requestSentEvent) {
    const parsed = contract.interface.parseLog({ topics: requestSentEvent.topics as string[], data: requestSentEvent.data });
    requestId = parsed?.args[0];
    console.log("   Request ID:", requestId?.toString());
  } else {
    const lastReqId = await contract.lastRequestId();
    requestId = lastReqId;
    console.log("   Request ID (from state):", requestId.toString());
  }

  // Poll for response
  console.log("\n4. Polling for response (max 120s)...");
  const startTime = Date.now();
  while (Date.now() - startTime < 120_000) {
    await new Promise(r => setTimeout(r, 5000));
    const result = await contract.getResult(requestId!);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result[0]) { // received = true
      console.log(`\n   [${elapsed}s] RESPONSE RECEIVED!`);
      console.log("   Status:", result[1].toString());
      console.log("   Finish reason:", result[2]);
      console.log("   Response:", result[3]);
      console.log("   Timestamp:", result[4].toString());
      return;
    }
    console.log(`   [${elapsed}s] waiting...`);
  }
  console.log("\n   Timeout 120s. Response may still come via callback later.");
  console.log("   Contract:", addr);
  console.log("   Request ID:", requestId?.toString());
  console.log("   Check later: contract.getResult(requestId)");
}

main().catch(console.error);
