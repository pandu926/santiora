import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy
  console.log("\n1. Deploying TestDomains...");
  const Factory = await ethers.getContractFactory("TestDomains");
  const contract = await Factory.deploy({ gasLimit: 30_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  const deposit = await contract.getDeposit();
  console.log("   Deposit per call:", ethers.formatEther(deposit), "STT");

  // Fund with 5 STT (enough for ~9 calls @ 0.33)
  console.log("\n2. Funding with 5 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // Fire all tests
  const tests = [
    { name: "ESPN", fn: "testESPN" },
    { name: "BBC Sport", fn: "testBBCSport" },
    { name: "SkySports", fn: "testSkySports" },
    { name: "CoinMarketCap", fn: "testCoinMarketCap" },
    { name: "CoinDesk", fn: "testCryptoNews" },
    { name: "TechCrunch", fn: "testTechCrunch" },
    { name: "TheVerge", fn: "testTheVerge" },
    { name: "Reuters", fn: "testReuters" },
    { name: "CNBC", fn: "testCNBC" },
  ];

  console.log("\n3. Firing all 9 domain tests...");
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

  // Collect request IDs
  const ids: { id: bigint; label: string }[] = [];
  for (let i = 0; i < Number(count); i++) {
    const id = await contract.requestIds(i);
    const r = await contract.results(id);
    ids.push({ id, label: r.label });
  }
  console.log("   Request IDs:", ids.map(x => `${x.label}=${x.id}`).join(", "));

  // Poll for responses (max 180s)
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
        const statusMap: Record<number, string> = { 2: "SUCCESS", 3: "FAILED", 4: "TIMED_OUT" };
        const statusLabel = statusMap[result.status] || `STATUS_${result.status}`;
        console.log(`   [${elapsed}s] ${ids[i].label} — ${statusLabel} → "${result.value.slice(0, 100)}"`);
      }
    }

    if (done.every(d => d)) break;

    const pendingCount = done.filter(d => !d).length;
    if (elapsed % 15 === 0) {
      const pendingLabels = ids.filter((_, i) => !done[i]).map(x => x.label).join(", ");
      console.log(`   [${elapsed}s] ${pendingCount} pending: ${pendingLabels}`);
    }
  }

  // Final summary
  console.log("\n=== FINAL RESULTS ===");
  console.log("Domain                | Status      | Response Time | Value");
  console.log("----------------------|-------------|---------------|------");
  for (let i = 0; i < ids.length; i++) {
    const result = await contract.results(ids[i].id);
    const status = result.received
      ? (result.status === 2 ? "SUCCESS" : result.status === 3 ? "FAILED" : "TIMEOUT")
      : "NO_RESPONSE";
    const value = result.value ? result.value.slice(0, 50) : "-";
    console.log(`${ids[i].label.padEnd(22)}| ${status.padEnd(12)}| ${done[i] ? "< 180s" : "> 180s"}       | ${value}`);
  }

  console.log("\nContract:", addr);
  console.log("Balance remaining:", ethers.formatEther(await ethers.provider.getBalance(addr)), "STT");
}

main().catch(console.error);
