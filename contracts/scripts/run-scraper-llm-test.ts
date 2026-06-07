import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);

  // Deploy
  const factory = await ethers.getContractFactory("TestScraperLLM");
  const receiver = await factory.deploy({ gasLimit: 200_000_000n });
  await receiver.waitForDeployment();
  const addr = await receiver.getAddress();
  console.log(`TestScraperLLM deployed: ${addr}`);

  // Fund with 3 STT (5 requests x ~0.43 STT each)
  const fundTx = await signer.sendTransaction({ to: addr, value: ethers.parseEther("3"), gasLimit: 200_000_000n });
  await fundTx.wait();
  console.log(`Funded 3 STT`);

  const deposit = await receiver.getDeposit();
  console.log(`Deposit per request: ${ethers.formatEther(deposit)} STT`);

  // Submit all 5 tests
  console.log("\n=== Submitting requests ===");

  console.log("1. Scraper: ESPN NFL...");
  const tx1 = await receiver.testScraper_ESPN({ gasLimit: 200_000_000n });
  await tx1.wait();
  console.log(`   tx: ${tx1.hash}`);

  console.log("2. Scraper: BBC Sport...");
  const tx2 = await receiver.testScraper_BBC({ gasLimit: 200_000_000n });
  await tx2.wait();
  console.log(`   tx: ${tx2.hash}`);

  console.log("3. Scraper: Crypto/CoinDesk...");
  const tx3 = await receiver.testScraper_Crypto({ gasLimit: 200_000_000n });
  await tx3.wait();
  console.log(`   tx: ${tx3.hash}`);

  console.log("4. LLM: Market quality (single)...");
  const tx4 = await receiver.testLLM_MarketQuality({ gasLimit: 200_000_000n });
  await tx4.wait();
  console.log(`   tx: ${tx4.hash}`);

  console.log("5. LLM: Multi-market creation...");
  const tx5 = await receiver.testLLM_MultiMarket({ gasLimit: 200_000_000n });
  await tx5.wait();
  console.log(`   tx: ${tx5.hash}`);

  const reqCount = await receiver.requestCount();
  console.log(`\n${reqCount} requests submitted. Polling for callbacks...`);

  // Poll for 180s
  const POLL_MS = 10_000;
  const MAX_MS = 180_000;
  const t0 = Date.now();
  let lastReceived = 0;

  while (Date.now() - t0 < MAX_MS) {
    let received = 0;
    for (let i = 0; i < Number(reqCount); i++) {
      const r = await receiver.getResult(i);
      if (r.received) {
        received++;
        if (received > lastReceived) {
          console.log(`\n━━━ [${i}] ${r.label} ━━━`);
          console.log(`  Status: ${r.status === 2 ? "SUCCESS" : r.status === 3 ? "FAILED" : r.status === 4 ? "TIMED_OUT" : `code=${r.status}`}`);
          if (r.value.length > 0) {
            console.log(`  Length: ${r.value.length} chars`);
            console.log(`  Content:\n${r.value.slice(0, 800)}`);
            if (r.value.length > 800) console.log(`  ... (${r.value.length} total)`);
          } else {
            console.log(`  (empty response)`);
          }
        }
      }
    }
    lastReceived = received;
    if (received >= Number(reqCount)) {
      console.log(`\n✓ All ${received} responses received!`);
      break;
    }
    process.stdout.write(`.`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Final summary
  console.log("\n\n=== FINAL RESULTS ===");
  for (let i = 0; i < Number(reqCount); i++) {
    const r = await receiver.getResult(i);
    const statusLabel = r.status === 2 ? "OK" : r.status === 3 ? "FAIL" : r.status === 4 ? "TIMEOUT" : `?${r.status}`;
    console.log(`[${i}] ${r.label}: ${r.received ? statusLabel : "PENDING"} (${r.value.length} chars)`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
