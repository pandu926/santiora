import { ethers } from "hardhat";

const V4_ADDRESS = "0xbc2455C2D2d75B70ee97AcDC87da11f6FEd301F3";
const REACTIVE_ADDRESS = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const v4 = await ethers.getContractAt("SantioraV4", V4_ADDRESS);
  const reactive = new ethers.Contract(REACTIVE_ADDRESS, [
    "function setFinalV2(address) external",
    "function finalV2() external view returns (address)",
    "function owner() external view returns (address)",
    "function startCreateLoop() external",
    "function startResolveLoop() external",
    "function createSubscriptionId() external view returns (uint256)",
    "function resolveSubscriptionId() external view returns (uint256)",
    "function getStats() external view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  ], deployer);

  // Check current state
  const currentTarget = await reactive.finalV2();
  console.log(`\nReactive current target: ${currentTarget}`);
  console.log(`Reactive owner: ${await reactive.owner()}`);

  // 1. Point reactive to V4
  console.log(`\n1. setFinalV2(${V4_ADDRESS})...`);
  const tx1 = await reactive.setFinalV2(V4_ADDRESS, { gasLimit: 500_000n });
  await tx1.wait();
  console.log(`   Done. New target: ${await reactive.finalV2()}`);

  // 2. Authorize reactive in V4
  console.log(`\n2. v4.setReactiveContract(${REACTIVE_ADDRESS})...`);
  const tx2 = await (v4 as any).setReactiveContract(REACTIVE_ADDRESS, { gasLimit: 5_000_000n });
  await tx2.wait();
  console.log(`   Done. V4 reactiveContract: ${await (v4 as any).reactiveContract()}`);

  // 3. Check if loops are already running
  const createSub = await reactive.createSubscriptionId();
  const resolveSub = await reactive.resolveSubscriptionId();
  console.log(`\nCreate loop subscription: ${createSub}`);
  console.log(`Resolve loop subscription: ${resolveSub}`);

  if (createSub === 0n) {
    console.log(`\n3. Starting create loop...`);
    const tx3 = await reactive.startCreateLoop({ gasLimit: 5_000_000n });
    await tx3.wait();
    console.log(`   Create loop started.`);
  } else {
    console.log(`   Create loop already running.`);
  }

  if (resolveSub === 0n) {
    console.log(`\n4. Starting resolve loop...`);
    const tx4 = await reactive.startResolveLoop({ gasLimit: 5_000_000n });
    await tx4.wait();
    console.log(`   Resolve loop started.`);
  } else {
    console.log(`   Resolve loop already running.`);
  }

  // Verify
  const [createFires, resolveFires, autoResolves, marketsCreated] = await reactive.getStats();
  console.log(`\n=== Reactive Stats ===`);
  console.log(`  Create fires: ${createFires}`);
  console.log(`  Resolve fires: ${resolveFires}`);
  console.log(`  Auto resolves: ${autoResolves}`);
  console.log(`  Markets created: ${marketsCreated}`);

  // Check V4 can receive from reactive
  const [canCreate, reason] = await (v4 as any)["canCreateMarket()"]();
  console.log(`\n  V4 canCreateMarket: ${canCreate} (${reason})`);
  console.log(`\nWiring complete. Reactive -> V4 autonomous loop active.`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
