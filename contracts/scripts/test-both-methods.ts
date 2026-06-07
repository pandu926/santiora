import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestBothMethods...");
  const Factory = await ethers.getContractFactory("TestBothMethods");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // Fund with 2 STT (enough for 2 calls)
  console.log("\n2. Funding with 2 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // Call both methods
  console.log("\n3. Calling testToolsChat...");
  const tx1 = await contract.testToolsChat({ gasLimit: 50_000_000n });
  const r1 = await tx1.wait();
  console.log("   TX:", tx1.hash, "Gas:", r1!.gasUsed.toString());

  console.log("\n4. Calling testInferChat...");
  const tx2 = await contract.testInferChat({ gasLimit: 50_000_000n });
  const r2 = await tx2.wait();
  console.log("   TX:", tx2.hash, "Gas:", r2!.gasUsed.toString());

  const toolsReqId = await contract.toolsChatRequestId();
  const chatReqId = await contract.inferChatRequestId();
  console.log("\n   inferToolsChat Request ID:", toolsReqId.toString());
  console.log("   inferChat Request ID:", chatReqId.toString());

  // Poll both
  console.log("\n5. Polling for responses (max 90s)...");
  const startTime = Date.now();
  let toolsDone = false;
  let chatDone = false;

  while (Date.now() - startTime < 90_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (!toolsDone) {
      const res = await contract.toolsChatResult();
      if (res.received) {
        toolsDone = true;
        console.log(`\n   [${elapsed}s] inferToolsChat RECEIVED!`);
        console.log("   Status:", res.status.toString(), res.status === 2 ? "SUCCESS" : "FAILED");
        console.log("   Data:", res.data.slice(0, 300));
      }
    }

    if (!chatDone) {
      const res = await contract.inferChatResult();
      if (res.received) {
        chatDone = true;
        console.log(`\n   [${elapsed}s] inferChat RECEIVED!`);
        console.log("   Status:", res.status.toString(), res.status === 2 ? "SUCCESS" : "FAILED");
        console.log("   Data:", res.data.slice(0, 300));
      }
    }

    if (toolsDone && chatDone) break;
    if (!toolsDone && !chatDone) console.log(`   [${elapsed}s] waiting...`);
  }

  if (!toolsDone) console.log("\n   inferToolsChat: no response in 90s");
  if (!chatDone) console.log("\n   inferChat: no response in 90s");

  console.log("\n=== SUMMARY ===");
  console.log("Contract:", addr);
  console.log("inferToolsChat:", toolsDone ? "responded" : "pending");
  console.log("inferChat:", chatDone ? "responded" : "pending");
}

main().catch(console.error);
