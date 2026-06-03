import { ethers } from "hardhat";

const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const REGISTRY = "0xd68d350D6eedE5DbABCd658EBA009583FF28A46B";
const OLD_RESOLVER = "0xA4DC6742B061Cafc7847D7A6c285CDf2Ffcbb324";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  console.log("\n1. Deploy new Creator (with _jsonString whitespace fix)...");
  const Creator = await ethers.getContractFactory("SantioraV3Creator");
  const creator = await Creator.deploy(COORD, REGISTRY, { gasLimit: 100_000_000n });
  await creator.waitForDeployment();
  const creatorAddr = await creator.getAddress();
  console.log("   Creator:", creatorAddr);

  console.log("\n2. Re-wire coord modules → new creator...");
  const coord = await ethers.getContractAt("SantioraFinalV3", COORD);
  await (await (coord as any).setModules(creatorAddr, OLD_RESOLVER, { gasLimit: 5_000_000n })).wait();

  console.log("\n3. Fund new creator with 3 STT...");
  await (await deployer.sendTransaction({ to: creatorAddr, value: ethers.parseEther("3"), gasLimit: 200_000n })).wait();

  console.log("\n=== NEW CREATOR ===");
  console.log("CREATOR:", creatorAddr);
  const bal = ethers.formatEther(await ethers.provider.getBalance(creatorAddr));
  console.log("balance:", bal, "STT");
  console.log("\ncoord.creatorModule:", await (coord as any).creatorModule());
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
