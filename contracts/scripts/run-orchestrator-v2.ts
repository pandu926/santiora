import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);

  const factory = await ethers.getContractFactory("TestOrchestratorV2");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`TestOrchestratorV2 deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 200_000_000n })).wait();
  console.log(`Funded 2 STT\n`);

  console.log("1. Tools + maxIter=0 (LLM sees tools, can't execute)...");
  await (await contract.test_ToolsIter0({ gasLimit: 200_000_000n })).wait();

  console.log("2. Tools + maxIter=1...");
  await (await contract.test_ToolsIter1({ gasLimit: 200_000_000n })).wait();

  console.log("3. Tools + maxIter=2...");
  await (await contract.test_ToolsIter2({ gasLimit: 200_000_000n })).wait();

  console.log("4. No tools + maxIter=0 (baseline V2)...");
  await (await contract.test_NoToolsIter0({ gasLimit: 200_000_000n })).wait();

  console.log("\n4 requests submitted. Polling 180s...\n");

  const MAX_MS = 180_000;
  const POLL_MS = 10_000;
  const t0 = Date.now();
  const printed = new Set<number>();

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
          console.log(`  ${r.response.slice(0, 1000)}`);
          console.log(`  Pending tool calls: ${r.pendingCount}`);
          if (Number(r.pendingCount) > 0) {
            const pending = await contract.getPendingCalls(i);
            for (let j = 0; j < pending.ids.length; j++) {
              console.log(`    tool[${j}] id=${pending.ids[j]}`);
              console.log(`    tool[${j}] data=${ethers.toUtf8String(pending.calls[j]).slice(0, 200)}`);
            }
          }
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
