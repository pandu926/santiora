import { ethers } from "hardhat";

const REGISTRY = "0xd68d350D6eedE5DbABCd658EBA009583FF28A46B";
const REACTIVE = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";
const OLD_RESOLVER = "0xA4DC6742B061Cafc7847D7A6c285CDf2Ffcbb324";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  console.log("\n1. Deploy SantioraFinalV3 (no-arg overloads + balance guard)...");
  const Coord = await ethers.getContractFactory("SantioraFinalV3");
  const coord = await Coord.deploy(REGISTRY, { gasLimit: 100_000_000n });
  await coord.waitForDeployment();
  const coordAddr = await coord.getAddress();
  console.log("   Coord:", coordAddr);

  console.log("\n2. Deploy SantioraV3Creator pointing at new coord...");
  const Creator = await ethers.getContractFactory("SantioraV3Creator");
  const creator = await Creator.deploy(coordAddr, REGISTRY, { gasLimit: 100_000_000n });
  await creator.waitForDeployment();
  const creatorAddr = await creator.getAddress();
  console.log("   Creator:", creatorAddr);

  console.log("\n3. setReactiveContract...");
  await (await (coord as any).setReactiveContract(REACTIVE, { gasLimit: 5_000_000n })).wait();

  console.log("\n4. setModules...");
  await (await (coord as any).setModules(creatorAddr, OLD_RESOLVER, { gasLimit: 5_000_000n })).wait();

  console.log("\n5. Reactive.setFinalV2 → new coord...");
  const reactive = new ethers.Contract(REACTIVE, ["function setFinalV2(address) external"], deployer);
  await (await reactive.setFinalV2(coordAddr, { gasLimit: 2_000_000n })).wait();

  console.log("\n6. Fund creator with 3 STT...");
  await (await deployer.sendTransaction({ to: creatorAddr, value: ethers.parseEther("3"), gasLimit: 200_000n })).wait();

  console.log("\n7. Fund coord with 0.5 STT...");
  await (await deployer.sendTransaction({ to: coordAddr, value: ethers.parseEther("0.5"), gasLimit: 200_000n })).wait();

  console.log("\n=== VERIFY ===");
  const minBal = await (creator as any).minBalanceForCreate();
  console.log("minBalanceForCreate:", ethers.formatEther(minBal), "STT");
  console.log("creator balance:    ", ethers.formatEther(await ethers.provider.getBalance(creatorAddr)), "STT");

  const noArgCan = await (coord as any)["canCreateMarket()"]();
  console.log("canCreateMarket() no-arg:", noArgCan[0], noArgCan[1]);
  const nextCat = await (coord as any).getNextCategory();
  console.log("getNextCategory:", nextCat);
  const withArgCan = await (coord as any)["canCreateMarket(string)"](nextCat);
  console.log("canCreateMarket(string):", withArgCan[0], withArgCan[1]);

  console.log("\n=== FINAL ADDRESSES ===");
  console.log("COORD:   ", coordAddr);
  console.log("CREATOR: ", creatorAddr);
  console.log("RESOLVER:", OLD_RESOLVER);
  console.log("REGISTRY:", REGISTRY);
  console.log("REACTIVE:", REACTIVE);
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
