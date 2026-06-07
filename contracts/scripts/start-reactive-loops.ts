import { ethers } from "hardhat";

const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const bal = await ethers.provider.getBalance(REACTIVE);
  console.log(`Reactive balance: ${ethers.formatEther(bal)} STT`);

  const iface = new ethers.Interface([
    "function startCreateLoop() external",
    "function startResolveLoop() external",
  ]);

  console.log("\nStarting create loop (raw tx, gasLimit 200M)...");
  const tx1 = await signer.sendTransaction({
    to: REACTIVE,
    data: iface.encodeFunctionData("startCreateLoop"),
    gasLimit: 200_000_000n,
  });
  const r1 = await tx1.wait();
  console.log(`  status: ${r1!.status}, gasUsed: ${r1!.gasUsed}`);

  console.log("\nStarting resolve loop...");
  const tx2 = await signer.sendTransaction({
    to: REACTIVE,
    data: iface.encodeFunctionData("startResolveLoop"),
    gasLimit: 200_000_000n,
  });
  const r2 = await tx2.wait();
  console.log(`  status: ${r2!.status}, gasUsed: ${r2!.gasUsed}`);

  console.log("\nDone.");
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
