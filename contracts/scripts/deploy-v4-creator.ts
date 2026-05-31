import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MarketCreatorV4Agent with:", deployer.address);

  const Factory = await ethers.getContractFactory("MarketCreatorV4Agent");
  const contract = await Factory.deploy({ gasLimit: 30_000_000 });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("MarketCreatorV4Agent deployed at:", addr);

  // Fund it with STT for agent calls
  const fundTx = await deployer.sendTransaction({
    to: addr,
    value: ethers.parseEther("5"),
    gasLimit: 100000
  });
  await fundTx.wait();
  console.log("Funded with 5 STT");

  // Trigger first pipeline
  console.log("\nTriggering pipeline: espn.com...");
  const tx = await contract.startMarketCreation("espn.com", {
    value: ethers.parseEther("0.36"),
    gasLimit: 15_000_000
  });
  const receipt = await tx.wait();
  console.log("TX:", receipt!.hash);
  console.log("Status:", receipt!.status === 1 ? "SUCCESS" : "REVERTED");
  console.log("Gas used:", receipt!.gasUsed.toString());

  const draftCount = await contract.draftCount();
  console.log("Draft count:", draftCount.toString());

  const draft = await contract.getDraft(0);
  console.log("Draft 0 step:", ["Idle","ScrapingNews","GeneratingQuestion","SettingOdds","Complete"][Number(draft[0])]);
  console.log("\nPipeline triggered! Waiting for Somnia Agent Platform callback...");
  console.log("Contract address:", addr);
}

main().catch((e) => { console.error(e); process.exit(1); });
