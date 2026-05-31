import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const F = await ethers.getContractFactory("MarketCreatorV4Agent");
  const c = await F.deploy({ gasLimit: 50000000 });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("V5 deployed:", addr);
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 50000 })).wait();
  console.log("Funded 5 STT");
  const tx = await c.startMarketCreation("coindesk.com", { value: ethers.parseEther("1.08"), gasLimit: 50000000 });
  const r = await tx.wait();
  console.log("Status:", r!.status === 1 ? "SUCCESS" : "REVERTED", "| gas:", r!.gasUsed.toString());
  const d = await c.getDraft(0);
  console.log("Step:", ["Idle","ScrapingNews","GeneratingQuestion","SettingOdds","Complete"][Number(d[0])]);
  console.log("Contract:", addr);
}
main().catch((e) => { console.error(e.message?.slice(0, 200)); process.exit(1); });
