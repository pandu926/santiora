import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SantioraFinalV2 with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const REGISTRY = "0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677";

  const Factory = await ethers.getContractFactory("SantioraFinalV2");
  const contract = await Factory.deploy(REGISTRY, { gasLimit: 50_000_000n });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SantioraFinalV2 deployed at:", address);

  // Fund contract with 10 STT for agent calls
  const fundTx = await deployer.sendTransaction({
    to: address,
    value: ethers.parseEther("10"),
    gasLimit: 100_000n,
  });
  await fundTx.wait();
  console.log("Funded with 10 STT");

  // Read initial state
  const rules = await contract.rules();
  console.log("\nRules Engine:");
  console.log("  scanInterval:", rules.scanInterval.toString(), "seconds");
  console.log("  maxRetryCreate:", rules.maxRetryCreate.toString());
  console.log("  maxRetryResolve:", rules.maxRetryResolve.toString());
  console.log("  confidenceThreshold:", rules.confidenceThreshold.toString());
  console.log("  maxMarketsPerDay:", rules.maxMarketsPerDay.toString());
  console.log("  minMarketDuration:", (Number(rules.minMarketDuration) / 3600).toString(), "hours");

  const balance = await ethers.provider.getBalance(address);
  console.log("\nContract balance:", ethers.formatEther(balance), "STT");

  // Add FinalV2 as registrar in MarketRegistry
  const registryAbi = [
    "function addRegistrar(address registrar) external",
    "function authorizedRegistrars(address) external view returns (bool)",
  ];
  const registry = new ethers.Contract(REGISTRY, registryAbi, deployer);

  const addTx = await registry.addRegistrar(address, { gasLimit: 5_000_000n });
  await addTx.wait();
  const isRegistrar = await registry.authorizedRegistrars(address);
  console.log("Added as registrar:", isRegistrar);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Address:", address);
  console.log("Registry:", REGISTRY);
  console.log("Next: call createMarket('sports') to test");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
