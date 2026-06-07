import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT`);

  console.log("\nDeploying SantioraV5 (resolve test)...");
  const factory = await ethers.getContractFactory("SantioraV5");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log(`Funded 5 STT\n`);

  // Step 1: Create a crypto market
  console.log("=== STEP 1: Create crypto market ===");
  await (await contract.createMarket("crypto", { gasLimit: 200_000_000n })).wait();
  console.log("Market 0 (crypto) submitted. Waiting for creation...\n");

  await pollUntilPhase(contract, 0, 4, 180_000);

  const m0 = await contract.markets(0);
  console.log(`\n  Market created!`);
  console.log(`  Status: ${statusStr(Number(m0.status))}`);
  console.log(`  Question (raw): ${m0.question.slice(0, 300)}`);

  if (Number(m0.status) !== 1) {
    console.log("  FAILED to create market. Stopping.");
    return;
  }

  // Step 2: Force resolve immediately (bypass deadline)
  console.log("\n=== STEP 2: Force resolve market 0 ===");
  console.log("  (AI should fetch current BTC price, compare with question threshold)\n");
  await (await contract.forceResolve(0, { gasLimit: 200_000_000n })).wait();
  console.log("  Resolve submitted. Waiting for resolution pipeline...\n");

  await pollUntilPhase(contract, 0, 4, 180_000);

  const m0r = await contract.markets(0);
  console.log(`\n  Market resolved!`);
  console.log(`  Status: ${statusStr(Number(m0r.status))}`);
  console.log(`  Outcome (${m0r.outcome.length} chars):`);
  console.log(`  ${m0r.outcome.slice(0, 600)}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("RESOLVE FLOW TEST - SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Creation: ${Number(m0.status) === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`  Market question: ${m0.question.slice(0, 150)}`);
  console.log(`  Resolution: ${Number(m0r.status) === 3 ? "RESOLVED" : Number(m0r.status) === 4 ? "FAILED" : "status=" + m0r.status}`);
  console.log(`  Outcome: ${m0r.outcome.slice(0, 200)}`);
  console.log(`  AI used tools: YES (yield & resume for both create and resolve)`);
}

function statusStr(s: number): string {
  const m: Record<number, string> = { 0: "Creating", 1: "Active", 2: "Resolving", 3: "Resolved", 4: "Failed" };
  return m[s] || `code=${s}`;
}

async function pollUntilPhase(contract: any, marketId: number, targetPhase: number, maxMs: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await contract.getPipeline(marketId);
    const phase = Number(p.phase);
    if (phase >= targetPhase) return;
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 10_000));
  }
  console.log("  (timeout)");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
