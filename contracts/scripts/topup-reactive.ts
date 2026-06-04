import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";

  const tx = await signer.sendTransaction({
    to: REACTIVE,
    value: ethers.parseEther("20"),
    gasLimit: 100_000n,
  });
  await tx.wait();

  const bal = await ethers.provider.getBalance(REACTIVE);
  console.log(`ReactiveV4 balance: ${ethers.formatEther(bal)} STT`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
