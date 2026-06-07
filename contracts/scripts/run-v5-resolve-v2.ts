import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT\n`);

  // Use the already deployed V5 from first test: 0x78d6ba2F9a492a8d25ab846CeC3848494B3342ac
  // Market 0 was: "Will Bitcoin (BTC) price exceed $65,000 by June 12, 2026?" odds=30
  // BTC was $62,686 at creation. Let's resolve it — AI should fetch current BTC price and compare.

  // Deploy fresh with updated code (resolve fix + better prompt)
  console.log("Deploying SantioraV5 (resolve test v2)...");
  const factory = await ethers.getContractFactory("SantioraV5");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("4"), gasLimit: 100_000n })).wait();
  console.log(`Funded 4 STT\n`);

  // Create a market that is ALREADY resolvable right now
  // We'll create one asking: "Is BTC above $60,000 today?" — answer should be YES (currently ~$62-63k)
  // Trick: create with short deadline by hacking — but instead let's just create normally
  // and forceResolve. The key is the prompt tells AI "compare current vs threshold"
  // and we removed the "if deadline not passed output UNRESOLVABLE" rule.

  console.log("=== STEP 1: Create crypto market ===");
  await (await contract.createMarket("crypto", { gasLimit: 200_000_000n })).wait();
  console.log("Market 0 submitted. Waiting...\n");

  await pollUntilDone(contract, 0, 180_000);

  const m = await contract.markets(0);
  console.log(`  Status: ${statusStr(Number(m.status))}`);
  console.log(`  Question: ${m.question.slice(0, 250)}`);

  if (Number(m.status) !== 1) {
    console.log("  Creation failed. Stopping.");
    return;
  }

  // Now force resolve — AI should:
  // 1. Fetch current BTC price
  // 2. Compare with the threshold in the question
  // 3. Return YES or NO with evidence
  console.log("\n=== STEP 2: Force resolve ===");
  console.log("  AI will fetch current data and compare with question threshold\n");
  await (await contract.forceResolve(0, { gasLimit: 200_000_000n })).wait();
  console.log("  Resolve dispatched. Waiting...\n");

  await pollUntilDone(contract, 0, 180_000);

  const mr = await contract.markets(0);
  console.log(`\n  Final Status: ${statusStr(Number(mr.status))}`);
  console.log(`  Outcome (${mr.outcome.length} chars):`);
  console.log(`  ${mr.outcome}`);

  // Print pipeline info
  const pipe = await contract.getPipeline(0);
  console.log(`\n  Pipeline: phase=${pipe.phase} iter=${pipe.iteration} tools=${pipe.completed}/${pipe.totalPending}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("RESOLVE TEST V2 - RESULTS");
  console.log("=".repeat(60));

  const resolved = Number(mr.status) === 3;
  const backedToActive = Number(mr.status) === 1;
  console.log(`  Market question: ${m.question.slice(0, 150)}`);
  console.log(`  Resolve status: ${resolved ? "RESOLVED" : backedToActive ? "REVERTED TO ACTIVE (unresolvable)" : statusStr(Number(mr.status))}`);
  if (resolved) {
    console.log(`  Outcome: ${mr.outcome.slice(0, 300)}`);
    console.log(`  AI fetched data and compared: YES`);
  }
}

function statusStr(s: number): string {
  const m: Record<number, string> = { 0: "Creating", 1: "Active", 2: "Resolving", 3: "Resolved", 4: "Failed" };
  return m[s] || `code=${s}`;
}

async function pollUntilDone(contract: any, marketId: number, maxMs: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await contract.getPipeline(marketId);
    const phase = Number(p.phase);
    if (phase === 4) return; // Phase.Done
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 10_000));
  }
  console.log("  (timeout)");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
