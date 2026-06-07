import { ethers } from "hardhat";

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const SCRAPER_AGENT_ID = 12875401142070969085n;
const LLM_AGENT_ID = 12847293847561029384n;
const JSON_AGENT_ID = 13174292974160097713n;

const PLATFORM_ABI = [
  "function createRequest(uint256 agentId, address callbackContract, bytes4 callbackFunction, bytes calldata payload) external payable returns (uint256)",
];

const SCRAPER_IFACE = [
  "function fetchContent(string url) external returns (string)",
];

const LLM_IFACE = [
  "function inferToolsChat(string prompt) external returns (string)",
];

const JSON_IFACE = [
  "function fetchString(string url, string selector) external returns (string)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const platform = new ethers.Contract(PLATFORM, PLATFORM_ABI, signer);

  // Dummy callback (we won't receive it, just want to see what gets submitted)
  const dummyCallback = "0x00000000";
  const dummyAddr = await signer.getAddress();

  // 1. Test Scraper - fetch sports news
  console.log("=== Test 1: Scraper — ESPN NFL news ===");
  const scraperPayload = new ethers.Interface(SCRAPER_IFACE).encodeFunctionData("fetchContent", [
    "https://www.espn.com/nfl/"
  ]);
  const tx1 = await platform.createRequest(SCRAPER_AGENT_ID, dummyAddr, dummyCallback, scraperPayload, {
    value: ethers.parseEther("0.33"),
    gasLimit: 5_000_000n,
  });
  const r1 = await tx1.wait();
  console.log(`  tx: ${tx1.hash}`);
  console.log(`  status: ${r1!.status}, gasUsed: ${r1!.gasUsed}`);

  // 2. Test Scraper - crypto news
  console.log("\n=== Test 2: Scraper — CoinDesk ===");
  const scraperPayload2 = new ethers.Interface(SCRAPER_IFACE).encodeFunctionData("fetchContent", [
    "https://www.coindesk.com/markets/"
  ]);
  const tx2 = await platform.createRequest(SCRAPER_AGENT_ID, dummyAddr, dummyCallback, scraperPayload2, {
    value: ethers.parseEther("0.33"),
    gasLimit: 5_000_000n,
  });
  const r2 = await tx2.wait();
  console.log(`  tx: ${tx2.hash}`);
  console.log(`  status: ${r2!.status}, gasUsed: ${r2!.gasUsed}`);

  // 3. Test LLM - ask for market ideas
  console.log("\n=== Test 3: LLM — market quality prompt ===");
  const llmPayload = new ethers.Interface(LLM_IFACE).encodeFunctionData("inferToolsChat", [
    `You are a prediction market creator. Given this data about MLS soccer:
- Next fixture: Inter Miami vs Charlotte FC (June 7, 2026)
- League leader: Inter Miami (45 pts, form: WWDWW)
- 2nd place: Columbus Crew (40 pts)

Create ONE high-quality prediction market question that:
1. Is specific and verifiable
2. Has a realistic deadline (AFTER the event)
3. Has meaningful odds (not 50/50)
4. Is interesting to bet on

Return JSON: {"question":"...","deadline":"YYYY-MM-DD","odds":N,"reasoning":"..."}`
  ]);
  const tx3 = await platform.createRequest(LLM_AGENT_ID, dummyAddr, dummyCallback, llmPayload, {
    value: ethers.parseEther("0.33"),
    gasLimit: 5_000_000n,
  });
  const r3 = await tx3.wait();
  console.log(`  tx: ${tx3.hash}`);
  console.log(`  status: ${r3!.status}, gasUsed: ${r3!.gasUsed}`);

  console.log("\n=== Requests submitted. Check callbacks in ~30-60s ===");
  console.log("Monitor with: npx hardhat run scripts/check-events.ts --network somnia");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
