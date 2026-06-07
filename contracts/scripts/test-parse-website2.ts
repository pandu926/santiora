import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestParseWebsite2...");
  const Factory = await ethers.getContractFactory("TestParseWebsite2");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  const deposit = await contract.getDeposit();
  console.log("   Deposit per call:", ethers.formatEther(deposit), "STT");

  // Fund with 3 STT (3 calls)
  console.log("\n2. Funding with 3 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("3"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // Test 1: GitHub direct URL
  console.log("\n3. Test 1: ExtractString — GitHub trending (direct URL, resolveUrl=false)...");
  const tx1 = await contract.test1_GithubDirect({ gasLimit: 50_000_000n });
  await tx1.wait();
  const id1 = await contract.reqId1();
  console.log("   Request ID:", id1.toString());

  // Test 2: CoinGecko domain search
  console.log("\n4. Test 2: ExtractString — CoinGecko (resolveUrl=true, numPages=1)...");
  const tx2 = await contract.test2_CoinGeckoSearch({ gasLimit: 50_000_000n });
  await tx2.wait();
  const id2 = await contract.reqId2();
  console.log("   Request ID:", id2.toString());

  // Test 3: BBC Sport direct URL
  console.log("\n5. Test 3: ExtractString — BBC Sport (direct URL)...");
  const tx3 = await contract.test3_BBCSport({ gasLimit: 50_000_000n });
  await tx3.wait();
  const id3 = await contract.reqId3();
  console.log("   Request ID:", id3.toString());

  // Poll for responses
  console.log("\n6. Polling for responses (max 180s)...");
  const startTime = Date.now();
  const ids = [
    { id: id1, label: "GitHub direct" },
    { id: id2, label: "CoinGecko search" },
    { id: id3, label: "BBC direct" },
  ];
  const done = [false, false, false];

  while (Date.now() - startTime < 180_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    for (let i = 0; i < ids.length; i++) {
      if (done[i]) continue;
      const result = await contract.results(ids[i].id);
      if (result.received) {
        done[i] = true;
        const statusLabel = result.status === 2 ? "SUCCESS" : result.status === 3 ? "FAILED" : result.status === 4 ? "TIMED_OUT" : `STATUS_${result.status}`;
        console.log(`\n   [${elapsed}s] ${ids[i].label} — ${statusLabel}`);
        console.log(`   Value: "${result.value}"`);
      }
    }

    if (done.every(d => d)) break;
    const pending = ids.filter((_, i) => !done[i]).map(x => x.label).join(", ");
    console.log(`   [${elapsed}s] pending: ${pending}`);
  }

  console.log("\n=== SUMMARY ===");
  for (let i = 0; i < ids.length; i++) {
    const result = await contract.results(ids[i].id);
    const statusLabel = result.received
      ? (result.status === 2 ? "SUCCESS" : "FAILED/TIMEOUT")
      : "NO RESPONSE";
    console.log(`   ${ids[i].label}: ${statusLabel} ${result.value ? `→ "${result.value}"` : ""}`);
  }
}

main().catch(console.error);
