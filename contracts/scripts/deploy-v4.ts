import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const F = await ethers.getContractFactory("MarketCreatorV4Agent");
  const c = await F.deploy({ gasLimit: 50000000 });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("V4 deployed:", addr);

  const fund = await deployer.sendTransaction({ to: addr, value: ethers.parseEther("3"), gasLimit: 50000 });
  await fund.wait();
  console.log("Funded 3 STT");

  const tx = await c.startMarketCreation("espn.com", { value: ethers.parseEther("0.81"), gasLimit: 50000000 });
  const r = await tx.wait();
  console.log("startMarketCreation:", r!.status === 1 ? "SUCCESS" : "REVERTED", "| gas:", r!.gasUsed.toString());
  console.log("Logs:", r!.logs.length);
  const count = await c.draftCount();
  console.log("Draft count:", count.toString());
  if (count > 0n) {
    const draft = await c.getDraft(0);
    console.log("Step:", ["Idle","ScrapingNews","GeneratingQuestion","SettingOdds","Complete"][Number(draft[0])]);
  }
  console.log("\nContract:", addr);
}

main().catch((e) => { console.error(e.message?.slice(0, 200) || e); process.exit(1); });
