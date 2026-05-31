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

  const REGISTRY = "0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677";

  // Read compiled artifact
  const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../artifacts/src/agents/SantioraFinalV2.sol/SantioraFinalV2.json"), "utf8"));

  // 1. Deploy
  console.log("\n1. Deploying SantioraFinalV2...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(REGISTRY, { gasLimit: 100_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("   Deployed:", addr);

  // 2. Fund with 5 STT
  console.log("\n2. Funding with 5 STT...");
  await (await wallet.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log("   Funded");

  // 3. Add as registrar
  console.log("\n3. Adding as registrar...");
  const registryAbi = [
    "function addRegistrar(address registrar) external",
    "function authorizedRegistrars(address) external view returns (bool)",
    "function getMarketCount() external view returns (uint256)",
  ];
  const registry = new ethers.Contract(REGISTRY, registryAbi, wallet);
  await (await registry.addRegistrar(addr, { gasLimit: 5_000_000n })).wait();
  const isRegistrar = await registry.authorizedRegistrars(addr);
  console.log("   Is registrar:", isRegistrar);

  // 4. Check rules
  const rules = await contract.rules();
  console.log("\n4. Rules Engine:");
  console.log("   scanInterval:", rules.scanInterval.toString(), "s");
  console.log("   maxMarketsPerDay:", rules.maxMarketsPerDay.toString());

  // 5. Create market
  console.log("\n5. Creating market (sports)...");
  const tx = await contract.createMarket("sports", { gasLimit: 50_000_000n });
  const receipt = await tx.wait();
  console.log("   TX:", tx.hash);
  console.log("   Gas:", receipt.gasUsed.toString());

  // 6. Poll for response
  console.log("\n6. Waiting for LLM response (max 60s)...");
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - start) / 1000);

    const market = await contract.getMarket(0);
    const status = Number(market[4]);

    if (status === 1) { // Active
      console.log(`\n   [${elapsed}s] MARKET ACTIVE!`);
      console.log("   Question:", market[0]);
      console.log("   Odds:", market[1].toString());
      console.log("   Deadline:", new Date(Number(market[2]) * 1000).toISOString());
      console.log("   Category:", market[3]);

      const regCount = await registry.getMarketCount();
      console.log("\n   Registry market count:", regCount.toString());
      console.log("\n   === FULL PIPELINE SUCCESS ===");
      console.log("   Contract:", addr);
      return;
    } else if (status === 4) { // Failed
      console.log(`\n   [${elapsed}s] MARKET FAILED`);
      const stats = await contract.getStats();
      console.log("   Stats:", stats.toString());
      return;
    }
    console.log(`   [${elapsed}s] status=${status} (Creating)...`);
  }
  console.log("\n   Timeout. Contract:", addr);
}

main().catch(console.error);
