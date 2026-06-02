import { ethers } from "hardhat";

const COORDINATOR = "0x06d7308C8BC931737F5D448C9a755D84CE23773f";
const REGISTRY = "0xd68d350D6eedE5DbABCd658EBA009583FF28A46B";
const OLD_RESOLVER = "0xA4DC6742B061Cafc7847D7A6c285CDf2Ffcbb324";
const FUND_AMOUNT = "3";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  console.log("\n1. Deploying new SantioraV3Creator...");
  const Factory = await ethers.getContractFactory("SantioraV3Creator");
  const creator = await Factory.deploy(COORDINATOR, REGISTRY, { gasLimit: 100_000_000n });
  await creator.waitForDeployment();
  const creatorAddress = await creator.getAddress();
  console.log("   New SantioraV3Creator:", creatorAddress);

  console.log("\n2. Wiring coordinator -> new creator...");
  const coord = new ethers.Contract(COORDINATOR, [
    "function setModules(address creator_, address resolver_) external"
  ], deployer);
  const wireTx = await coord.setModules(creatorAddress, OLD_RESOLVER, { gasLimit: 5_000_000n });
  await wireTx.wait();
  console.log("   Wired. tx:", wireTx.hash);

  console.log("\n3. Funding new creator with", FUND_AMOUNT, "STT...");
  const fundTx = await deployer.sendTransaction({
    to: creatorAddress,
    value: ethers.parseEther(FUND_AMOUNT),
    gasLimit: 100_000n
  });
  await fundTx.wait();
  console.log("   Funded. tx:", fundTx.hash);

  console.log("\n=== READY ===");
  console.log("New SantioraV3Creator:", creatorAddress);
  console.log("Coordinator:", COORDINATOR);
  console.log("Registry:", REGISTRY);
  console.log("\nUpdate frontend SANTIORA_V3_CREATOR to:", creatorAddress);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
