import { ethers } from "hardhat";

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const SCRAPER_AGENT_ID = 12875401142070969085n;
const LLM_AGENT_ID = 12847293847561029384n;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);

  // Deploy test receiver
  const factory = await ethers.getContractFactory("AgentTestReceiver");
  const receiver = await factory.deploy({ gasLimit: 5_000_000n });
  await receiver.waitForDeployment();
  const addr = await receiver.getAddress();
  console.log(`Receiver deployed: ${addr}`);

  // Fund receiver for agent deposits
  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 100_000n })).wait();
  console.log(`Funded 2 STT`);

  // 1. Scraper: fetch ESPN NFL
  console.log("\n--- Scraper: ESPN NFL ---");
  const tx1 = await (receiver as any).testScraper(
    "https://www.espn.com/nfl/",
    { gasLimit: 5_000_000n }
  );
  await tx1.wait();
  console.log(`  submitted: ${tx1.hash}`);

  // 2. Scraper: CoinDesk
  console.log("--- Scraper: CoinDesk ---");
  const tx2 = await (receiver as any).testScraper(
    "https://www.coindesk.com/markets/",
    { gasLimit: 5_000_000n }
  );
  await tx2.wait();
  console.log(`  submitted: ${tx2.hash}`);

  // 3. LLM: market ideas with context
  console.log("--- LLM: Market quality ---");
  const tx3 = await (receiver as any).testLLM(
    `You are a prediction market creator. Today is June 4, 2026.
Given MLS data: Inter Miami vs Charlotte FC on June 7. Inter Miami leads with 45pts (form WWDWW). Columbus Crew 2nd with 40pts.

Create ONE prediction market. Return ONLY JSON:
{"question":"...","deadline":"YYYY-MM-DD","odds":NUMBER_1_to_99,"category":"sports","reasoning":"2-3 sentences"}

Rules: deadline MUST be after the event can be verified. Odds must reflect probability, not 50/50.`,
    { gasLimit: 5_000_000n }
  );
  await tx3.wait();
  console.log(`  submitted: ${tx3.hash}`);

  // Poll for responses
  console.log(`\n--- Polling for callbacks (120s max) ---`);
  const POLL = 5000;
  const MAX = 120_000;
  const t0 = Date.now();

  while (Date.now() - t0 < MAX) {
    const count = Number(await (receiver as any).responseCount());
    if (count > 0) {
      console.log(`\n=== ${count} response(s) received ===`);
      for (let i = 0; i < count; i++) {
        const resp = await (receiver as any).responses(i);
        console.log(`\n[${i}] reqId=${resp.requestId} chars=${resp.content.length}`);
        console.log(`    content: ${resp.content.slice(0, 500)}`);
        if (resp.content.length > 500) console.log(`    ... (${resp.content.length} total chars)`);
      }
      if (count >= 3) break;
    }
    await new Promise(r => setTimeout(r, POLL));
    process.stdout.write(".");
  }

  const finalCount = Number(await (receiver as any).responseCount());
  if (finalCount === 0) console.log("\nNo responses received in 120s");
  else if (finalCount < 3) console.log(`\nOnly ${finalCount}/3 responses received`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
