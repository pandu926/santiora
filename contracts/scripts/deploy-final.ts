import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const F = await ethers.getContractFactory("SantioraOrchestrator");
  const c = await F.deploy({ gasLimit: 50000000 });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("SantioraOrchestrator v2:", addr);

  // Fund minimal
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("0.5"), gasLimit: 50000 })).wait();

  // Create 1 market to test date fix
  const tx = await c.createMarket("sports (NBA Finals, Champions League, UFC)", { value: ethers.parseEther("0.48"), gasLimit: 50000000 });
  const r = await tx.wait();
  console.log("createMarket:", r!.status === 1 ? "OK" : "FAIL");
  console.log("Address:", addr);
}
main().catch(e => { console.error(e.message?.slice(0,200)); process.exit(1); });
