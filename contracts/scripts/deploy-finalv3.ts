import { ethers } from "hardhat";

const EXISTING_REACTIVE_V2 = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";
const COORDINATOR_FUND = "1";
const CREATOR_FUND = "5";
const RESOLVER_FUND = "5";
const POLL_MS = 5_000;
const MAX_WAIT_MS = 240_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  console.log("\n1. Deploying MarketRegistryV2...");
  const RegistryFactory = await ethers.getContractFactory("MarketRegistryV2");
  const registry = await RegistryFactory.deploy({ gasLimit: 30_000_000n });
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   MarketRegistryV2:", registryAddress);

  console.log("\n2. Deploying SantioraFinalV3 coordinator...");
  const CoordinatorFactory = await ethers.getContractFactory("SantioraFinalV3");
  const coordinator = await CoordinatorFactory.deploy(registryAddress, { gasLimit: 100_000_000n });
  await coordinator.waitForDeployment();
  const coordinatorAddress = await coordinator.getAddress();
  console.log("   SantioraFinalV3:", coordinatorAddress);

  console.log("\n3. Deploying Creator module...");
  const CreatorFactory = await ethers.getContractFactory("SantioraV3Creator");
  const creator = await CreatorFactory.deploy(coordinatorAddress, registryAddress, { gasLimit: 100_000_000n });
  await creator.waitForDeployment();
  const creatorAddress = await creator.getAddress();
  console.log("   SantioraV3Creator:", creatorAddress);

  console.log("\n4. Deploying Resolver module...");
  const ResolverFactory = await ethers.getContractFactory("SantioraV3Resolver");
  const resolver = await ResolverFactory.deploy(coordinatorAddress, { gasLimit: 100_000_000n });
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("   SantioraV3Resolver:", resolverAddress);

  console.log("\n5. Wiring modules and registry...");
  await (await coordinator.setModules(creatorAddress, resolverAddress, { gasLimit: 5_000_000n })).wait();
  await (await registry.addRegistrar(coordinatorAddress, { gasLimit: 5_000_000n })).wait();
  console.log("   Modules set");
  console.log("   Coordinator registrar:", await registry.authorizedRegistrars(coordinatorAddress));

  console.log("\n6. Funding modules...");
  await (await deployer.sendTransaction({ to: coordinatorAddress, value: ethers.parseEther(COORDINATOR_FUND), gasLimit: 100_000n })).wait();
  await (await deployer.sendTransaction({ to: creatorAddress, value: ethers.parseEther(CREATOR_FUND), gasLimit: 100_000n })).wait();
  await (await deployer.sendTransaction({ to: resolverAddress, value: ethers.parseEther(RESOLVER_FUND), gasLimit: 100_000n })).wait();
  console.log("   Coordinator funded:", COORDINATOR_FUND, "STT");
  console.log("   Creator funded:", CREATOR_FUND, "STT");
  console.log("   Resolver funded:", RESOLVER_FUND, "STT");

  console.log("\n7. Wiring existing reactive V2 if owner allows...");
  const reactiveAbi = ["function setFinalV2(address _finalV2) external"];
  const reactive = new ethers.Contract(EXISTING_REACTIVE_V2, reactiveAbi, deployer);
  try {
    await (await reactive.setFinalV2(coordinatorAddress, { gasLimit: 5_000_000n })).wait();
    await (await coordinator.setReactiveContract(EXISTING_REACTIVE_V2, { gasLimit: 5_000_000n })).wait();
    console.log("   Reactive V2 pointed to coordinator:", EXISTING_REACTIVE_V2);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    console.log("   Reactive wiring skipped/failed:", message);
    console.log("   Manual owner test continues.");
  }

  console.log("\n8. Starting live createMarket('crypto')...");
  const tx = await coordinator.createMarket("crypto", { gasLimit: 20_000_000n });
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas:", receipt?.gasUsed.toString());

  console.log("\n9. Polling creation pipeline...");
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

    const market = await coordinator.getMarket(0);
    const stats = await coordinator.getStats();
    const status = Number(market[4]);
    console.log(`   [${elapsed}s] status=${status} registry=${registryCount.toString()} created=${stats[1].toString()} failed=${stats[3].toString()}`);

    if (status === 1) {
      console.log("\n=== V3 MODULAR CREATE SUCCESS ===");
      console.log("Question:", market[0]);
      console.log("Odds:", market[1].toString());
      console.log("Deadline:", new Date(Number(market[2]) * 1000).toISOString());
      console.log("Data:", market[7]);
      console.log("MarketRegistryV2:", registryAddress);
      console.log("SantioraFinalV3:", coordinatorAddress);
      console.log("SantioraV3Creator:", creatorAddress);
      console.log("SantioraV3Resolver:", resolverAddress);
      return;
    }

    if (status === 4) {
      console.log("\n=== V3 MODULAR CREATE FAILED ===");
      console.log("Question/response:", market[0]);
      console.log("Data:", market[7]);
      console.log("MarketRegistryV2:", registryAddress);
      console.log("SantioraFinalV3:", coordinatorAddress);
      console.log("SantioraV3Creator:", creatorAddress);
      console.log("SantioraV3Resolver:", resolverAddress);
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n=== V3 MODULAR CREATE TIMEOUT ===");
  console.log("MarketRegistryV2:", registryAddress);
  console.log("SantioraFinalV3:", coordinatorAddress);
  console.log("SantioraV3Creator:", creatorAddress);
  console.log("SantioraV3Resolver:", resolverAddress);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
