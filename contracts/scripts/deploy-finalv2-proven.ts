import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const REGISTRY = "0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677";

  // 1. Deploy SantioraFinalV2
  console.log("\n1. Deploying SantioraFinalV2...");
  const Factory = await ethers.getContractFactory("SantioraFinalV2");
  const contract = await Factory.deploy(REGISTRY, { gasLimit: 100_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // 2. Fund with 5 STT
  console.log("\n2. Funding with 5 STT...");
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // 3. Add as registrar in MarketRegistry
  console.log("\n3. Adding as registrar...");
  const registryAbi = [
    "function addRegistrar(address registrar) external",
    "function authorizedRegistrars(address) external view returns (bool)",
  ];
  const registry = new ethers.Contract(REGISTRY, registryAbi, deployer);
  await (await registry.addRegistrar(addr, { gasLimit: 5_000_000n })).wait();
  const isRegistrar = await registry.authorizedRegistrars(addr);
  console.log("   Is registrar:", isRegistrar);

  // 4. Check rules
  const rules = await contract.rules();
  console.log("\n4. Rules Engine:");
  console.log("   scanInterval:", rules.scanInterval.toString(), "s");
  console.log("   maxRetryCreate:", rules.maxRetryCreate.toString());
  console.log("   maxRetryResolve:", rules.maxRetryResolve.toString());
  console.log("   maxMarketsPerDay:", rules.maxMarketsPerDay.toString());
  console.log("   minMarketDuration:", (Number(rules.minMarketDuration) / 3600).toString(), "hours");

  // 5. Call createMarket("sports")
  console.log("\n5. Creating market (sports)...");
  const tx = await contract.createMarket("sports", { gasLimit: 50_000_000n });
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas:", receipt!.gasUsed.toString());

  const marketCount = await contract.getMarketCount();
  console.log("   Market count:", marketCount.toString());

  // 6. Poll for brain response (max 60s)
  console.log("\n6. Waiting for LLM response (max 60s)...");
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - start) / 1000);

    const market = await contract.getMarket(0);
    // market: (question, odds, deadline, category, status, outcome, confidence, resolutionData)
    const status = Number(market[4]); // 0=Creating, 1=Active, 4=Failed

    if (status === 1) { // Active
      console.log(`\n   [${elapsed}s] MARKET ACTIVE!`);
      console.log("   Question:", market[0]);
      console.log("   Odds:", market[1].toString());
      console.log("   Deadline:", new Date(Number(market[2]) * 1000).toISOString());
      console.log("   Category:", market[3]);

      // Check if registered
      const registryAbi2 = ["function getMarketCount() external view returns (uint256)"];
      const reg2 = new ethers.Contract(REGISTRY, registryAbi2, deployer);
      const regCount = await reg2.getMarketCount();
      console.log("\n   Registry market count:", regCount.toString());
      console.log("\n   === FULL PIPELINE SUCCESS ===");
      console.log("   Contract:", addr);
      return;
    } else if (status === 4) { // Failed
      console.log(`\n   [${elapsed}s] MARKET FAILED`);
      return;
    }
    console.log(`   [${elapsed}s] status=${status} (Creating)...`);
  }
  console.log("\n   Timeout. Contract:", addr);

  // Print stats
  const stats = await contract.getStats();
  console.log("   Stats - total:", stats[0].toString(), "created:", stats[1].toString(), "failed:", stats[3].toString());
}

main().catch(console.error);
