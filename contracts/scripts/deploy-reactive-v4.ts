import { ethers } from "hardhat";

const V4_ADDRESS = "0xbc2455C2D2d75B70ee97AcDC87da11f6FEd301F3";
const OLD_REACTIVE = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";
const CREATE_INTERVAL = 4500n;
const RESOLVE_INTERVAL = 4500n;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} STT`);

  // 1. Withdraw from old reactive
  console.log(`\n1. Withdraw from old reactive...`);
  const oldReactive = new ethers.Contract(OLD_REACTIVE, [
    "function withdrawAll() external",
  ], deployer);
  const oldBal = await ethers.provider.getBalance(OLD_REACTIVE);
  console.log(`   Old reactive balance: ${ethers.formatEther(oldBal)} STT`);
  if (oldBal > 0n) {
    await (await oldReactive.withdrawAll({ gasLimit: 5_000_000n })).wait();
    console.log(`   Withdrawn.`);
  }

  // 2. Deploy new reactive
  console.log(`\n2. Deploy SantioraReactiveV4...`);
  const F = await ethers.getContractFactory("SantioraReactiveV4");
  const reactive = await F.deploy(V4_ADDRESS, CREATE_INTERVAL, RESOLVE_INTERVAL, { gasLimit: 30_000_000n });
  await reactive.waitForDeployment();
  const addr = await reactive.getAddress();
  console.log(`   ReactiveV4: ${addr}`);

  // 3. Wire V4
  console.log(`\n3. Wire V4 -> ReactiveV4...`);
  const v4 = await ethers.getContractAt("SantioraV4", V4_ADDRESS);
  await (await (v4 as any).setReactiveContract(addr, { gasLimit: 5_000_000n })).wait();
  console.log(`   V4 reactiveContract: ${await (v4 as any).reactiveContract()}`);

  // 4. Fund
  console.log(`\n4. Fund ReactiveV4...`);
  const fundAmount = ethers.parseEther("20");
  await (await deployer.sendTransaction({ to: addr, value: fundAmount, gasLimit: 100_000n })).wait();
  console.log(`   Funded: ${ethers.formatEther(await ethers.provider.getBalance(addr))} STT`);

  // 5. Start loops
  console.log(`\n5. Start loops...`);
  await (await (reactive as any).startCreateLoop({ gasLimit: 5_000_000n })).wait();
  console.log(`   Create loop started`);
  await (await (reactive as any).startResolveLoop({ gasLimit: 5_000_000n })).wait();
  console.log(`   Resolve loop started`);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`\n=== Summary ===`);
  console.log(`  ReactiveV4: ${addr}`);
  console.log(`  V4: ${V4_ADDRESS}`);
  console.log(`  Current block: ${currentBlock}`);
  console.log(`  Next create: ~block ${currentBlock + Number(CREATE_INTERVAL)} (~${Math.round(Number(CREATE_INTERVAL) * 0.4)}s)`);
  console.log(`  Interval: ${CREATE_INTERVAL} blocks (~30min at 400ms/block)`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
