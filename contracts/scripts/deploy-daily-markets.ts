import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const susdAddress = "0xB553c0003C3F0419abD358A2edD16191fC86ef90";
  const factory = deployer.address; // deployer acts as factory for direct deploy

  const now = Math.floor(Date.now() / 1000);

  const markets = [
    { question: "Will Real Madrid beat Barcelona in tonight's El Clasico?", category: "sports", yesPercent: 55, deadline: now + 86400 },
    { question: "Will the Lakers win against the Celtics tonight?", category: "sports", yesPercent: 45, deadline: now + 72000 },
    { question: "Will India score 300+ runs in today's cricket match vs Australia?", category: "sports", yesPercent: 40, deadline: now + 86400 },
    { question: "Will Manchester United beat Arsenal this weekend?", category: "sports", yesPercent: 35, deadline: now + 172800 },
    { question: "Will Bitcoin close above $110,000 today?", category: "crypto", yesPercent: 52, deadline: now + 43200 },
    { question: "Will ETH gas fees stay below 10 gwei for the next 24 hours?", category: "crypto", yesPercent: 60, deadline: now + 86400 },
    { question: "Will the Fed announce rate cut at today's meeting?", category: "politics", yesPercent: 30, deadline: now + 28800 },
    { question: "Will PSG beat Inter Milan in Champions League tonight?", category: "sports", yesPercent: 50, deadline: now + 64800 },
    { question: "Will Djokovic win his French Open match today?", category: "sports", yesPercent: 70, deadline: now + 54000 },
    { question: "Will Somnia testnet process 1M transactions today?", category: "crypto", yesPercent: 65, deadline: now + 86400 },
  ];

  const PredictionMarketSUSD = await ethers.getContractFactory("PredictionMarketSUSD");
  const susd = await ethers.getContractAt("IERC20", susdAddress);

  const deployed: any[] = [];

  for (const m of markets) {
    console.log(`\nDeploying: ${m.question}`);

    const market = await PredictionMarketSUSD.deploy(
      m.question,
      m.deadline,
      ["https://google.com/search"],
      ethers.encodeBytes32String(m.category),
      150, // 1.5% fee
      deployer.address, // factory = deployer (so we can activate)
      susdAddress,
      { gasLimit: 30_000_000 }
    );
    await market.waitForDeployment();
    const addr = await market.getAddress();
    console.log(`  Deployed at: ${addr}`);

    // Seed liquidity: approve + addLiquidity
    const totalLiquidity = ethers.parseEther("500");
    const yesLiq = totalLiquidity * BigInt(100 - m.yesPercent) / 100n;
    const noLiq = totalLiquidity * BigInt(m.yesPercent) / 100n;

    const approveTx = await susd.approve(addr, totalLiquidity, { gasLimit: 5_000_000 });
    await approveTx.wait();
    console.log(`  Approved ${ethers.formatEther(totalLiquidity)} SUSD`);

    const addLiqTx = await market.addLiquidity(yesLiq, noLiq, { gasLimit: 10_000_000 });
    await addLiqTx.wait();
    console.log(`  Liquidity added: YES=${ethers.formatEther(yesLiq)} NO=${ethers.formatEther(noLiq)}`);

    // Activate
    const activateTx = await market.activate({ gasLimit: 5_000_000 });
    await activateTx.wait();
    console.log(`  Activated!`);

    deployed.push({
      address: addr,
      question: m.question,
      category: m.category,
      yesPercent: m.yesPercent,
      deadline: m.deadline,
      yesLiquidity: ethers.formatEther(yesLiq),
      noLiquidity: ethers.formatEther(noLiq),
    });
  }

  // Save
  const fs = require("fs");
  const output = {
    network: "somnia-testnet",
    chainId: 50312,
    susdToken: susdAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    liquidityPerMarket: "500",
    feePercent: "1.5%",
    markets: deployed,
  };

  fs.writeFileSync("deployments/daily-markets.json", JSON.stringify(output, null, 2));
  console.log("\n\nAll markets deployed! Saved to deployments/daily-markets.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
