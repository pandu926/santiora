import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy TestToolsFinal (uses callback to store response)
  console.log("\n1. Deploying TestToolsFinal...");
  const Factory = await ethers.getContractFactory("TestToolsFinal");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // Fund with 1 STT
  console.log("\n2. Funding with 1 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n })).wait();

  // Encode payload with CORRECT interface (selector 0xd0683905)
  // inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)
  const iface = new ethers.Interface([
    "function inferToolsChat(string[] roles, string[] messages, string[] mcpServerUrls, tuple(string a, string b)[] onchainTools, uint256 maxIterations, bool chainOfThought)"
  ]);

  const payload = iface.encodeFunctionData("inferToolsChat", [
    ["system", "user"],
    [
      "You are Santiora AI, an autonomous prediction market creator on Somnia blockchain. Today is May 31, 2026. Return only valid JSON.",
      'Create a YES/NO prediction market about a sports event happening June 1-7, 2026. Return JSON: {"question":"<specific question>","odds":50,"category":"sports","reasoning":"<why>"}'
    ],
    [], // mcpServerUrls
    [], // onchainTools
    0,  // maxIterations
    false // chainOfThought
  ]);

  console.log("\n3. Selector:", payload.slice(0, 10), "(expected 0xd0683905)");

  // Send via sendRawPayload (callback stores result)
  console.log("   Sending inferToolsChat...");
  const tx = await contract.sendRawPayload(payload, { gasLimit: 50_000_000n });
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas:", receipt!.gasUsed.toString());
  const reqId = await contract.toolsRequestId();
  console.log("   Request ID:", reqId.toString());

  // Poll for response
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
        console.log("   Raw result length:", raw.length);

        // Decode inferToolsChat response
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        try {
          const decoded = abiCoder.decode(
            ["string", "string", "string[]", "string[]", "string[]", "bytes[]"],
            raw
          );
          console.log("\n   === DECODED RESPONSE ===");
          console.log("   finishReason:", decoded[0]);
          console.log("   response:", decoded[1].slice(0, 800));
          console.log("   pendingToolCallIds:", decoded[4]);
          console.log("   pendingToolCalls count:", decoded[5].length);
        } catch (e: any) {
          // Maybe different format
          try {
            const decoded = abiCoder.decode(["string"], raw);
            console.log("   Decoded as string:", decoded[0].slice(0, 500));
          } catch {
            console.log("   Raw hex (first 300):", raw.slice(0, 300));
          }
        }
      }
      return;
    }
    console.log(`   [${elapsed}s] waiting...`);
  }
  console.log("\n   Timeout. Contract:", addr);
}

main().catch(console.error);
