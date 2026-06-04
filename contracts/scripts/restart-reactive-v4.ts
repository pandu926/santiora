import { ethers } from "hardhat";

const REACTIVE = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const reactive = new ethers.Contract(REACTIVE, [
    "function forceResetCreate() external",
    "function forceResetResolve() external",
    "function startCreateLoop() external",
    "function startResolveLoop() external",
    "function createSubscriptionId() view returns (uint256)",
    "function resolveSubscriptionId() view returns (uint256)",
    "function lastCreateBlock() view returns (uint256)",
    "function lastResolveBlock() view returns (uint256)",
    "function createIntervalBlocks() view returns (uint64)",
  ], signer);

  // 1. Force reset both (clear stuck subscription IDs)
  console.log("\n1. Force reset create...");
  const tx1 = await signer.sendTransaction({
    to: REACTIVE,
    data: reactive.interface.encodeFunctionData("forceResetCreate"),
    gasLimit: 200_000_000n,
  });
  await tx1.wait();
  console.log(`   Done. createSubId: ${await reactive.createSubscriptionId()}`);

  console.log("2. Force reset resolve...");
  const tx2 = await signer.sendTransaction({
    to: REACTIVE,
    data: reactive.interface.encodeFunctionData("forceResetResolve"),
    gasLimit: 200_000_000n,
  });
  await tx2.wait();
  console.log(`   Done. resolveSubId: ${await reactive.resolveSubscriptionId()}`);

  // 2. Restart loops — must use explicit data + high gasLimit for Somnia precompile
  const createData = reactive.interface.encodeFunctionData("startCreateLoop");
  const resolveData = reactive.interface.encodeFunctionData("startResolveLoop");

  console.log("\n3. Start create loop...");
  console.log(`   data: ${createData}`);
  const tx3 = await signer.sendTransaction({
    to: REACTIVE,
    data: createData,
    gasLimit: 200_000_000n,
    type: 0,
  });
  const r3 = await tx3.wait();
  console.log(`   gasUsed=${r3!.gasUsed} status=${r3!.status}`);
  if (r3!.status === 0) {
    console.log("   FAILED — trying with higher gas and checking balance...");
    const bal = await ethers.provider.getBalance(REACTIVE);
    console.log(`   Reactive balance: ${ethers.formatEther(bal)} STT`);
  } else {
    console.log(`   createSubId: ${await reactive.createSubscriptionId()}`);
  }

  console.log("4. Start resolve loop...");
  console.log(`   data: ${resolveData}`);
  const tx4 = await signer.sendTransaction({
    to: REACTIVE,
    data: resolveData,
    gasLimit: 200_000_000n,
    type: 0,
  });
  const r4 = await tx4.wait();
  console.log(`   gasUsed=${r4!.gasUsed} status=${r4!.status}`);
  if (r4!.status === 0) {
    console.log("   FAILED");
  } else {
    console.log(`   resolveSubId: ${await reactive.resolveSubscriptionId()}`);
  }

  const curBlock = await ethers.provider.getBlockNumber();
  const interval = Number(await reactive.createIntervalBlocks());
  console.log(`\nCurrent block: ${curBlock}`);
  console.log(`Interval: ${interval} blocks (~${Math.round(interval * 0.4)}s)`);
  console.log(`Next fire expected at block: ~${curBlock + interval}`);
  console.log(`\nDone. Monitor with: npx hardhat run scripts/check-events.ts --network somnia`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
