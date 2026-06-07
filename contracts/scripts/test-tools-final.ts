import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestToolsFinal...");
  const Factory = await ethers.getContractFactory("TestToolsFinal");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // Fund
  console.log("\n2. Funding with 1 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n })).wait();

  // Encode payload using viem-style tuple[] encoding
  // From our test, viem encodes tuple[] as selector 0x5fea582d
  // We replicate that encoding here using ethers
  // The key insight: viem's "tuple[]" with no components encodes as an empty dynamic array
  // which is identical to bytes[] encoding at the ABI level BUT with a different selector

  // Selector 0x5fea582d = keccak256("inferToolsChat(string[],string[],string[],(uint256)[],uint256,bool)") maybe?
  // Let's just use the raw payload from viem

  // Actually, let's encode it manually with the correct selector
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const params = abiCoder.encode(
    ["string[]", "string[]", "string[]", "bytes[]", "uint256", "bool"],
    [
      ["system", "user"],
      ["You are a helpful AI. Return only JSON.", 'Say hello. Return: {"msg":"hello"}'],
      [], // mcpServerUrls
      [], // onchainTools
      1,  // maxIterations
      true // chainOfThought
    ]
  );

  // Test with BOTH selectors
  const selectorBytes = "0x2acc8247"; // bytes[] selector
  const selectorTuple = "0x5fea582d"; // tuple[] selector (from viem)

  // Send with tuple[] selector (viem-style)
  const payloadTuple = selectorTuple + params.slice(2);
  console.log("\n3. Sending with tuple[] selector (0x5fea582d)...");
  const tx1 = await contract.sendRawPayload(payloadTuple, { gasLimit: 50_000_000n });
  const r1 = await tx1.wait();
  console.log("   TX:", tx1.hash, "Gas:", r1!.gasUsed.toString());
  const reqId1 = await contract.toolsRequestId();
  console.log("   Request ID:", reqId1.toString());

  // Poll
  console.log("\n4. Polling (max 60s)...");
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await contract.getResult();
    const elapsed = Math.round((Date.now() - start) / 1000);

    if (res[0]) { // received
      const statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
      console.log(`\n   [${elapsed}s] RECEIVED! Status: ${statusName} rawLen: ${res[2].toString()}`);

      if (Number(res[1]) === 2 && Number(res[2]) > 0) {
        const raw = await contract.getRawResult();
        console.log("   Raw result (first 300):", raw.slice(0, 300));
        // Try decode
        try {
          const decoded = abiCoder.decode(
            ["string", "string", "string[]", "string[]", "string[]", "bytes[]"],
            raw
          );
          console.log("\n   === DECODED ===");
          console.log("   finishReason:", decoded[0]);
          console.log("   response:", decoded[1]);
          console.log("   pendingToolCallIds:", decoded[4]);
        } catch (e: any) {
          console.log("   Decode failed:", e.message?.slice(0, 100));
        }
      }
      return;
    }
    console.log(`   [${elapsed}s] waiting...`);
  }
  console.log("\n   Timeout. Contract:", addr);
}

main().catch(console.error);
