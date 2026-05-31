import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SantioraOrchestrator with:", deployer.address);

  const F = await ethers.getContractFactory("SantioraOrchestrator");
  const c = await F.deploy({ gasLimit: 50000000 });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("SantioraOrchestrator deployed:", addr);

  // Fund with just enough for 2 market creations (0.48 * 2 = ~1 STT)
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 50000 })).wait();
  console.log("Funded 1 STT");

  // Trigger market creation — sports
  console.log("\n--- Creating market: sports ---");
  const tx1 = await c.createMarket("sports (football, NBA, cricket, UFC)", { value: ethers.parseEther("0.48"), gasLimit: 50000000 });
  const r1 = await tx1.wait();
  console.log("Status:", r1!.status === 1 ? "SUCCESS" : "REVERTED", "| gas:", r1!.gasUsed.toString());

  const d = await c.getDraft(0);
  console.log("Draft 0:", ["Idle","GeneratingQuestion","SettingOdds","Complete","Failed"][Number(d[0])]);

  console.log("\nContract:", addr);
  console.log("Monitor draft progress with getDraft(0)");
}

main().catch((e) => { console.error(e.message?.slice(0, 200)); process.exit(1); });
