import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT`);

  console.log("\nDeploying SantioraV5...");
  const factory = await ethers.getContractFactory("SantioraV5");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log(`Funded 5 STT`);

  const deposit = await contract.getDeposit();
  console.log(`Deposit/req: ${ethers.formatEther(deposit)} STT\n`);

  // Create market: crypto
  console.log("=== Creating market: crypto ===");
  const tx1 = await contract.createMarket("crypto", { gasLimit: 200_000_000n });
  await tx1.wait();
  console.log("Market 0 (crypto) submitted.\n");

  // Create market: sports
  console.log("=== Creating market: sports ===");
  const tx2 = await contract.createMarket("sports", { gasLimit: 200_000_000n });
  await tx2.wait();
  console.log("Market 1 (sports) submitted.\n");

  console.log("Polling for pipeline progress (5 min max)...\n");

  const MAX_MS = 300_000;
  const POLL_MS = 15_000;
  const t0 = Date.now();
  const reported = new Set<string>();

  while (Date.now() - t0 < MAX_MS) {
    const count = Number(await contract.marketCount());
    let allDone = true;

    for (let i = 0; i < count; i++) {
      const p = await contract.getPipeline(i);
      const phase = Number(p.phase);
      const key = `${i}-${phase}-${p.iteration}-${p.completed}`;

      if (!reported.has(key)) {
        reported.add(key);
        const phases = ["Idle", "Orchestrating", "ExecutingTools", "Resuming", "Done"];
        console.log(`  [Market ${i}] Phase=${phases[phase]} iter=${p.iteration} tools=${p.completed}/${p.totalPending}`);
      }

      if (phase !== 4) allDone = false; // Phase.Done = 4
    }

    if (allDone && count > 0) {
      console.log("\nAll markets done!\n");
      break;
    }

    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Print final results
  console.log("=".repeat(60));
  console.log("FINAL RESULTS");
  console.log("=".repeat(60));

  const count = Number(await contract.marketCount());
  for (let i = 0; i < count; i++) {
    const m = await contract.markets(i);
    const statusMap: Record<number, string> = { 0: "Creating", 1: "Active", 2: "Resolving", 3: "Resolved", 4: "Failed" };
    console.log(`\n[Market ${i}]`);
    console.log(`  Category: ${m.category}`);
    console.log(`  Status: ${statusMap[Number(m.status)] || m.status}`);
    console.log(`  Response (${m.question.length} chars):`);
    console.log(`  ${m.question.slice(0, 800)}`);
    if (m.question.length > 800) console.log(`  ... (${m.question.length} total)`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
