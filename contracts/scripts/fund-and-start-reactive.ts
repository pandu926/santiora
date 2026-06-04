import { ethers } from "hardhat";

const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";

async function main() {
  const [signer] = await ethers.getSigners();

  const balBefore = await ethers.provider.getBalance(REACTIVE);
  console.log(`Reactive balance: ${ethers.formatEther(balBefore)} STT`);
  console.log(`Need >= 32 STT for subscription`);

  const deficit = ethers.parseEther("33") - balBefore;
  if (deficit > 0n) {
    console.log(`\nTopping up ${ethers.formatEther(deficit)} STT...`);
    const tx = await signer.sendTransaction({
      to: REACTIVE,
      value: deficit,
      gasLimit: 100_000n,
    });
    await tx.wait();
    const balAfter = await ethers.provider.getBalance(REACTIVE);
    console.log(`New balance: ${ethers.formatEther(balAfter)} STT`);
  }

  // Now start loops
  const iface = new ethers.Interface([
    "function createSubscriptionId() view returns (uint256)",
    "function resolveSubscriptionId() view returns (uint256)",
    "function startCreateLoop() external",
    "function startResolveLoop() external",
    "function createIntervalBlocks() view returns (uint64)",
  ]);
  const reactive = new ethers.Contract(REACTIVE, iface, signer);

  const csub = await reactive.createSubscriptionId();
  const rsub = await reactive.resolveSubscriptionId();
  console.log(`\nCurrent createSubId: ${csub}, resolveSubId: ${rsub}`);

  if (csub === 0n) {
    console.log("\nStarting create loop...");
    const tx = await signer.sendTransaction({
      to: REACTIVE,
      data: iface.encodeFunctionData("startCreateLoop"),
      gasLimit: 200_000_000n,
    });
    const r = await tx.wait();
    console.log(`  status=${r!.status} gasUsed=${r!.gasUsed}`);
    console.log(`  createSubId: ${await reactive.createSubscriptionId()}`);
  }

  if (rsub === 0n) {
    console.log("Starting resolve loop...");
    const tx = await signer.sendTransaction({
      to: REACTIVE,
      data: iface.encodeFunctionData("startResolveLoop"),
      gasLimit: 200_000_000n,
    });
    const r = await tx.wait();
    console.log(`  status=${r!.status} gasUsed=${r!.gasUsed}`);
    console.log(`  resolveSubId: ${await reactive.resolveSubscriptionId()}`);
  }

  const interval = Number(await reactive.createIntervalBlocks());
  const curBlock = await ethers.provider.getBlockNumber();
  console.log(`\nCurrent block: ${curBlock}`);
  console.log(`Interval: ${interval} blocks (~${Math.round(interval * 0.4)}s / ~${Math.round(interval * 0.4 / 60)}min)`);
  console.log(`Next fire: ~block ${curBlock + interval}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
