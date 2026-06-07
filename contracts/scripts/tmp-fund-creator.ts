import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const CREATOR = "0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F";
  const before = await ethers.provider.getBalance(CREATOR);
  console.log("creator before:", ethers.formatEther(before), "STT");
  console.log("signer bal:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "STT");
  // Fund 3 STT — cukup untuk beberapa kali full create (0.78 each)
  const tx = await signer.sendTransaction({ to: CREATOR, value: ethers.parseEther("3"), gasLimit: 100_000n });
  await tx.wait();
  const after = await ethers.provider.getBalance(CREATOR);
  console.log("creator after :", ethers.formatEther(after), "STT");
  console.log("tx:", tx.hash);
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
