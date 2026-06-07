import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestToolsChatDebug...");
  const Factory = await ethers.getContractFactory("TestToolsChatDebug");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // Fund with 5 STT
  console.log("\n2. Funding with 5 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // Run all 4 tests
  const tests = [
    { name: "testHighDeposit", fn: () => contract.testHighDeposit({ gasLimit: 50_000_000n }) },
    { name: "testZeroIterations", fn: () => contract.testZeroIterations({ gasLimit: 50_000_000n }) },
    { name: "testNoCOT", fn: () => contract.testNoCOT({ gasLimit: 50_000_000n }) },
    { name: "testMaxDeposit", fn: () => contract.testMaxDeposit({ gasLimit: 50_000_000n }) },
  ];

  const reqIds: bigint[] = [];
  for (const t of tests) {
    console.log(`\n3. ${t.name}...`);
    const tx = await t.fn();
    const receipt = await tx.wait();
    console.log("   TX:", tx.hash, "Gas:", receipt!.gasUsed.toString());
  }

  // Get all request IDs
  const count = await contract.getRequestCount();
  console.log("\n   Total requests:", count.toString());
  for (let i = 0; i < Number(count); i++) {
    const id = await contract.requestIds(i);
    reqIds.push(id);
    console.log(`   Request ${i}: ${id.toString()}`);
  }

  // Poll
  console.log("\n4. Polling (max 60s)...");
  const startTime = Date.now();
  const done = new Set<number>();

  while (Date.now() - startTime < 60_000 && done.size < reqIds.length) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    for (let i = 0; i < reqIds.length; i++) {
      if (done.has(i)) continue;
      const res = await contract.getResult(reqIds[i]);
      if (res[0]) { // received
        done.add(i);
        const statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
        console.log(`   [${elapsed}s] ${res[3]}: Status=${statusName} rawLen=${res[2].toString()}`);
      }
    }
    if (done.size < reqIds.length) {
      console.log(`   [${elapsed}s] ${done.size}/${reqIds.length} done...`);
    }
  }

  console.log("\n=== RESULTS ===");
  for (let i = 0; i < reqIds.length; i++) {
    const res = await contract.getResult(reqIds[i]);
    const statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
    console.log(`${res[3]}: ${statusName} (rawLen=${res[2].toString()})`);

    if (Number(res[1]) === 2 && Number(res[2]) > 0) {
      const raw = await contract.getRawResult(reqIds[i]);
      console.log("  Raw (first 200):", raw.slice(0, 200));
    }
  }
}

main().catch(console.error);
