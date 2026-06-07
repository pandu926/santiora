import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);

  const factory = await ethers.getContractFactory("TestOrchestrator");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`TestOrchestrator deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 200_000_000n })).wait();
  console.log(`Funded 2 STT`);

  const deposit = await contract.getDeposit();
  console.log(`Deposit/req: ${ethers.formatEther(deposit)} STT\n`);

  console.log("1. Orchestrator with tools (BTC price -> market)...");
  await (await contract.testOrchestrator_WithTools({ gasLimit: 200_000_000n })).wait();

  console.log("2. Orchestrator sports (fetch MLS -> market)...");
  await (await contract.testOrchestrator_Sports({ gasLimit: 200_000_000n })).wait();

  console.log("3. Baseline no tools (LLM only)...");
  await (await contract.testBaseline_NoTools({ gasLimit: 200_000_000n })).wait();

  console.log("\n3 requests submitted. Polling 180s...\n");

  const MAX_MS = 180_000;
  const POLL_MS = 10_000;
  const t0 = Date.now();
  let printed = new Set<number>();

  while (Date.now() - t0 < MAX_MS) {
    const count = Number(await contract.resultCount());
    let received = 0;
    for (let i = 0; i < count; i++) {
      const r = await contract.getResult(i);
      if (r.received) {
        received++;
        if (!printed.has(i)) {
          printed.add(i);
          console.log(`\n━━━ [${i}] ${r.label} ━━━`);
          console.log(`  Status: ${r.status === 2 ? "SUCCESS" : r.status === 3 ? "FAILED" : `code=${r.status}`}`);
          console.log(`  FinishReason: "${r.finishReason}"`);
          console.log(`  Response (${r.response.length} chars):`);
          console.log(r.response.slice(0, 1200));
          if (r.response.length > 1200) console.log(`  ... (${r.response.length} total)`);
        }
      }
    }
    if (received >= count) {
      console.log(`\nAll ${received} responses received!`);
      break;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
