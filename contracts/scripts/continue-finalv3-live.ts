import { ethers } from "hardhat";

const EXISTING_REACTIVE_V2 = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";
const REGISTRY = process.env.REGISTRY ?? "0x9C0F3A9d1D7015995aAcf29f48fCB1A9464DF050";
const COORDINATOR = process.env.COORDINATOR ?? "0xEf2029e69b220DBE171351Bb7b8c00d7344861b9";
const CREATOR = process.env.CREATOR ?? "0x1c0267F2befD2D7AD1FC13b9A99095375e58d9C0";
const RESOLVER = process.env.RESOLVER ?? "0x3Cf5195Fd2ac050f6b35c1937c8205F118a7cF8c";
const POLL_MS = 5_000;
const MAX_WAIT_MS = 240_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const coordinator = await ethers.getContractAt("SantioraFinalV3", COORDINATOR);
  const registry = await ethers.getContractAt("MarketRegistryV2", REGISTRY);

  console.log("Deployer:", deployer.address);
  console.log("MarketRegistryV2:", REGISTRY);
  console.log("SantioraFinalV3:", COORDINATOR);
  console.log("SantioraV3Creator:", CREATOR);
  console.log("SantioraV3Resolver:", RESOLVER);

  console.log("\n1. Wiring reactive if needed...");
  const reactiveAbi = ["function setFinalV2(address _finalV2) external"];
  const reactive = new ethers.Contract(EXISTING_REACTIVE_V2, reactiveAbi, deployer);
  try {
    await (await reactive.setFinalV2(COORDINATOR, { gasLimit: 5_000_000n })).wait();
    await (await coordinator.setReactiveContract(EXISTING_REACTIVE_V2, { gasLimit: 5_000_000n })).wait();
    console.log("   Reactive V2 pointed to coordinator:", EXISTING_REACTIVE_V2);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    console.log("   Reactive wiring skipped/failed:", message);
  }

  console.log("\n2. Starting live createMarket('sports')...");
  const tx = await coordinator.createMarket("sports", { gasLimit: 20_000_000n });
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas:", receipt?.gasUsed.toString());

  console.log("\n3. Polling creation pipeline...");
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    await sleep(POLL_MS);
    const elapsed = Math.round((Date.now() - start) / 1000);
    const count = await coordinator.getMarketCount();
    const registryCount = await registry.getMarketCount();

    if (count === 0n) {
      console.log(`   [${elapsed}s] count=0 registry=${registryCount.toString()}`);
      continue;
    }

    const marketId = count - 1n;
    const market = await coordinator.getMarket(marketId);
    const stats = await coordinator.getStats();
    const status = Number(market[4]);
    console.log(`   [${elapsed}s] market=${marketId.toString()} status=${status} registry=${registryCount.toString()} created=${stats[1].toString()} failed=${stats[3].toString()}`);

    if (status === 1) {
      console.log("\n=== V3 MODULAR CREATE SUCCESS ===");
      console.log("Market:", marketId.toString());
      console.log("Question:", market[0]);
      console.log("Odds:", market[1].toString());
      console.log("Deadline:", new Date(Number(market[2]) * 1000).toISOString());
      console.log("Source:", market[5], market[6]);
      console.log("Data:", market[7]);
      console.log("Registry count:", registryCount.toString());
      return;
    }

    if (status === 4) {
      console.log("\n=== V3 MODULAR CREATE FAILED ===");
      console.log("Market:", marketId.toString());
      console.log("Question/response:", market[0]);
      console.log("Data:", market[7]);
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n=== V3 MODULAR CREATE TIMEOUT ===");
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
