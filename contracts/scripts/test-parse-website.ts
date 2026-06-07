import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestParseWebsite...");
  const Factory = await ethers.getContractFactory("TestParseWebsite");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // Check deposit needed
  const deposit = await contract.getDeposit();
  console.log("   Deposit per call:", ethers.formatEther(deposit), "STT");

  // Fund with 2 STT (enough for 2 calls)
  console.log("\n2. Funding with 2 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // Test ExtractString
  console.log("\n3. Calling testExtractString (BTC price from CoinGecko page)...");
  const tx1 = await contract.testExtractString({ gasLimit: 50_000_000n });
  const r1 = await tx1.wait();
  console.log("   TX:", tx1.hash);
  console.log("   Gas:", r1!.gasUsed.toString());

  // Test ExtractANumber
  console.log("\n4. Calling testExtractANumber (BTC price as number)...");
  const tx2 = await contract.testExtractANumber({ gasLimit: 50_000_000n });
  const r2 = await tx2.wait();
  console.log("   TX:", tx2.hash);
  console.log("   Gas:", r2!.gasUsed.toString());

  const stringReqId = await contract.extractStringReqId();
  const numberReqId = await contract.extractNumberReqId();
  console.log("\n   ExtractString Request ID:", stringReqId.toString());
  console.log("   ExtractANumber Request ID:", numberReqId.toString());

  // Poll for responses
  console.log("\n5. Polling for responses (max 120s)...");
  const startTime = Date.now();
  let stringDone = false;
  let numberDone = false;

  while (Date.now() - startTime < 120_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (!stringDone) {
      const received = await contract.stringReceived();
      if (received) {
        stringDone = true;
        const result = await contract.stringResult();
        const status = await contract.stringStatus();
        console.log(`\n   [${elapsed}s] ExtractString RECEIVED!`);
        console.log("   Status:", status.toString(), status === 2 ? "SUCCESS" : "FAILED");
        console.log("   Result:", result);
      }
    }

    if (!numberDone) {
      const received = await contract.numberReceived();
      if (received) {
        numberDone = true;
        const result = await contract.numberResult();
        const status = await contract.numberStatus();
        console.log(`\n   [${elapsed}s] ExtractANumber RECEIVED!`);
        console.log("   Status:", status.toString(), status === 2 ? "SUCCESS" : "FAILED");
        console.log("   Result:", result.toString());
      }
    }

    if (stringDone && numberDone) break;
    if (!stringDone || !numberDone) console.log(`   [${elapsed}s] waiting... (string: ${stringDone ? 'done' : 'pending'}, number: ${numberDone ? 'done' : 'pending'})`);
  }

  if (!stringDone) console.log("\n   ExtractString: no response in 120s");
  if (!numberDone) console.log("\n   ExtractANumber: no response in 120s");

  console.log("\n=== SUMMARY ===");
  console.log("Contract:", addr);
  console.log("ExtractString:", stringDone ? "responded" : "pending");
  console.log("ExtractANumber:", numberDone ? "responded" : "pending");
  if (stringDone) console.log("  String result:", await contract.stringResult());
  if (numberDone) console.log("  Number result:", (await contract.numberResult()).toString());
}

main().catch(console.error);
