const { ethers } = require("ethers");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const provider = new ethers.JsonRpcProvider("https://dream-rpc.somnia.network");
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  console.log("Deployer:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "STT");

  const FINALV2 = "0x4397fa19D2C3Cd4C00141e2Ccc4f74e347721ac2";

  // 1. Deploy SantioraReactiveV2
  console.log("\n1. Deploying SantioraReactiveV2...");
  const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../artifacts/src/agents/SantioraReactiveV2.sol/SantioraReactiveV2.json"), "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const reactive = await factory.deploy(FINALV2, { gasLimit: 100_000_000n });
  await reactive.waitForDeployment();
  const reactiveAddr = await reactive.getAddress();
  console.log("   Deployed:", reactiveAddr);

  // 2. Fund with 40 STT (needs balance for subscriptions + agent calls)
  console.log("\n2. Funding with 35 STT...");
  await (await wallet.sendTransaction({ to: reactiveAddr, value: ethers.parseEther("35"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // 3. Set ReactiveV2 as authorized in FinalV2
  console.log("\n3. Setting ReactiveV2 as authorized in FinalV2...");
  const finalV2Artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../artifacts/src/agents/SantioraFinalV2.sol/SantioraFinalV2.json"), "utf8"));
  const finalV2 = new ethers.Contract(FINALV2, finalV2Artifact.abi, wallet);
  await (await finalV2.setReactiveContract(reactiveAddr, { gasLimit: 5_000_000n })).wait();
  const reactiveSet = await finalV2.reactiveContract();
  console.log("   ReactiveContract set:", reactiveSet);

  // 4. Activate BlockTick subscription
  console.log("\n4. Activating BlockTick subscription...");
  await (await reactive.subscribeBlockTick(5_000_000, { gasLimit: 50_000_000n })).wait();
  const blockTickId = await reactive.blockTickSubscriptionId();
  console.log("   BlockTick subscription ID:", blockTickId.toString());

  // 5. Activate Schedule subscription
  console.log("\n5. Activating Schedule subscription...");
  await (await reactive.subscribeSchedule(5_000_000, { gasLimit: 50_000_000n })).wait();
  const scheduleId = await reactive.scheduleSubscriptionId();
  console.log("   Schedule subscription ID:", scheduleId.toString());

  // 6. Verify stats
  console.log("\n6. Initial stats:");
  const stats = await reactive.getStats();
  console.log("   BlockTicks:", stats[0].toString());
  console.log("   ScheduleFires:", stats[1].toString());
  console.log("   AutoResolves:", stats[2].toString());
  console.log("   MarketsCreated:", stats[3].toString());

  // 7. Wait and check if ticks start coming
  console.log("\n7. Waiting 30s for first ticks...");
  await new Promise(r => setTimeout(r, 30000));
  const stats2 = await reactive.getStats();
  console.log("   BlockTicks:", stats2[0].toString());
  console.log("   ScheduleFires:", stats2[1].toString());
  console.log("   LastBlock:", stats2[4].toString());

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("SantioraReactiveV2:", reactiveAddr);
  console.log("SantioraFinalV2:", FINALV2);
  console.log("BlockTick sub:", blockTickId.toString());
  console.log("Schedule sub:", scheduleId.toString());
}

main().catch(console.error);
