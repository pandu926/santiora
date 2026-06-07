import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);

  const factory = await ethers.getContractFactory("TestScraperLLMv2");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`TestScraperLLMv2 deployed: ${addr}`);

  // Fund 2 STT
  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 200_000_000n })).wait();
  console.log(`Funded 2 STT`);

  const deposit = await contract.getDeposit();
  console.log(`Deposit/req: ${ethers.formatEther(deposit)} STT`);

  // Submit 4 tests
  console.log("\n=== Submitting ===");

  console.log("1. LLM inferToolsChat (single market)...");
  await (await contract.testLLM_Single({ gasLimit: 200_000_000n })).wait();

  console.log("2. LLM inferChat (simpler)...");
  await (await contract.testLLM_Chat({ gasLimit: 200_000_000n })).wait();

  console.log("3. Scraper search mode (espn.com)...");
  await (await contract.testScraper_Search({ gasLimit: 200_000_000n })).wait();

  console.log("4. Scraper direct (github trending)...");
  await (await contract.testScraper_Direct({ gasLimit: 200_000_000n })).wait();

  console.log("\n4 requests submitted. Polling 180s...\n");

  const MAX_MS = 180_000;
  const POLL_MS = 10_000;
  const t0 = Date.now();
  let prevReceived = 0;

  while (Date.now() - t0 < MAX_MS) {
    const count = Number(await contract.resultCount());
    let received = 0;
    for (let i = 0; i < count; i++) {
      const meta = await contract.getResultMeta(i);
      if (meta.received) {
        received++;
        if (received > prevReceived) {
          console.log(`\n━━━ [${i}] ${meta.label} ━━━`);
          console.log(`  Status: ${meta.status === 2 ? "SUCCESS" : meta.status === 3 ? "FAILED" : meta.status === 4 ? "TIMEOUT" : `code=${meta.status}`}`);
          console.log(`  FinishReason: "${meta.finishReason}"`);
          console.log(`  Response length: ${meta.responseLen}`);
          console.log(`  Raw bytes: ${meta.rawLen}`);

          if (Number(meta.responseLen) > 0) {
            const resp = await contract.getResultResponse(i);
            console.log(`  Response:\n${resp.slice(0, 1000)}`);
            if (resp.length > 1000) console.log(`  ... (${resp.length} total)`);
          }
        }
      }
    }
    prevReceived = received;
    if (received >= count) {
      console.log(`\nAll ${received} responses received!`);
      break;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Final
  console.log("\n\n=== SUMMARY ===");
  const count = Number(await contract.resultCount());
  for (let i = 0; i < count; i++) {
    const meta = await contract.getResultMeta(i);
    const statusLabel = meta.status === 2 ? "OK" : meta.status === 3 ? "FAIL" : "?";
    console.log(`[${i}] ${meta.label}: ${meta.received ? statusLabel : "PENDING"} | finishReason="${meta.finishReason}" | resp=${meta.responseLen} chars | raw=${meta.rawLen} bytes`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
