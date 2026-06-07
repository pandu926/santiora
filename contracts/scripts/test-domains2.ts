import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  console.log("\n1. Deploying TestDomains2...");
  const Factory = await ethers.getContractFactory("TestDomains2");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  const deposit = await contract.getDeposit();
  console.log("   Deposit per call:", ethers.formatEther(deposit), "STT");

  // Fund with 6 STT (12 calls @ 0.33)
  console.log("\n2. Funding with 6 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("6"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  const tests = [
    { name: "Yahoo Sports", fn: "testYahooSports" },
    { name: "Fox Sports", fn: "testFoxSports" },
    { name: "CBS Sports", fn: "testCBSSports" },
    { name: "AP News", fn: "testAPNews" },
    { name: "CNN", fn: "testCNN" },
    { name: "Al Jazeera", fn: "testAlJazeera" },
    { name: "CryptoSlate", fn: "testCryptoSlate" },
    { name: "Decrypt", fn: "testDecrypt" },
    { name: "Ars Technica", fn: "testArsTechnica" },
    { name: "Wired", fn: "testWired" },
    { name: "MarketWatch", fn: "testMarketWatch" },
    { name: "Yahoo Finance", fn: "testYahooFinance" },
  ];

  console.log("\n3. Firing all 12 domain tests...");
  for (const t of tests) {
    try {
      const tx = await (contract as any)[t.fn]({ gasLimit: 50_000_000n });
      await tx.wait();
      console.log(`   [OK] ${t.name}`);
    } catch (e: any) {
      console.log(`   [FAIL] ${t.name}: ${e.message?.slice(0, 80)}`);
    }
  }

  const count = await contract.getRequestCount();
  console.log(`\n   Total requests sent: ${count}`);

  const ids: { id: bigint; label: string }[] = [];
  for (let i = 0; i < Number(count); i++) {
    const id = await contract.requestIds(i);
    const r = await contract.results(id);
    ids.push({ id, label: r.label });
  }

  // Poll (max 180s)
  console.log("\n4. Polling for responses (max 180s)...");
  const startTime = Date.now();
  const done = new Array(ids.length).fill(false);

  while (Date.now() - startTime < 180_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    for (let i = 0; i < ids.length; i++) {
      if (done[i]) continue;
      const result = await contract.results(ids[i].id);
      if (result.received) {
        done[i] = true;
        const statusLabel = result.status === 2 ? "SUCCESS" : result.status === 3 ? "FAILED" : "TIMEOUT";
        console.log(`   [${elapsed}s] ${ids[i].label} — ${statusLabel} → "${result.value.slice(0, 100)}"`);
      }
    }

    if (done.every(d => d)) break;

    const pendingCount = done.filter(d => !d).length;
    if (elapsed % 30 === 0 || pendingCount <= 3) {
      const pendingLabels = ids.filter((_, i) => !done[i]).map(x => x.label).join(", ");
      console.log(`   [${elapsed}s] ${pendingCount} pending: ${pendingLabels}`);
    }
  }

  // Final
  console.log("\n=== RESULTS ===");
  for (let i = 0; i < ids.length; i++) {
    const result = await contract.results(ids[i].id);
    const status = !result.received ? "NO_RESP" : result.status === 2 ? "OK" : "FAIL";
    const val = result.value ? result.value.slice(0, 60) : "-";
    console.log(`   ${status.padEnd(8)} ${ids[i].label.padEnd(20)} ${val}`);
  }

  console.log("\nContract:", addr);
  console.log("Balance remaining:", ethers.formatEther(await ethers.provider.getBalance(addr)), "STT");
}

main().catch(console.error);
