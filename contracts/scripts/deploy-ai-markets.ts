import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AI-generated markets with:", deployer.address);

  const susdAddress = "0xB553c0003C3F0419abD358A2edD16191fC86ef90";
  const now = Math.floor(Date.now() / 1000);

  // Questions from AI pipeline (on-chain drafts 3,6,7,14,19,20,28,29,30,33)
  const markets = [
    { question: "Will Gujarat Titans win the IPL 2026 Final against Royal Challengers Bengaluru?", category: "sports", yesPercent: 45, deadline: now + 172800 },
    { question: "Will Ilia Topuria defeat Charles Oliveira at UFC White House: Freedom 250 on June 14, 2026?", category: "sports", yesPercent: 55, deadline: now + 1209600 },
    { question: "Will Anthony Gordon complete his transfer from Newcastle United to FC Barcelona?", category: "sports", yesPercent: 40, deadline: now + 604800 },
    { question: "Will Bitcoin ETFs record a $2.8B outflow over a nine-day period within the next 30 days?", category: "crypto", yesPercent: 30, deadline: now + 259200 },
    { question: "Will Anthropic complete a $65B funding round and achieve a $1T valuation before July 2026?", category: "technology", yesPercent: 35, deadline: now + 2592000 },
    { question: "Will the US Department of Justice reverse the shutdown of its crypto crime unit within 30 days?", category: "politics", yesPercent: 20, deadline: now + 259200 },
  ];

  const susd = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", susdAddress);
  const deployed: any[] = [];

  for (const m of markets) {
    console.log(`\nDeploying: ${m.question.slice(0, 70)}...`);

    const PredictionMarketSUSD = await ethers.getContractFactory("PredictionMarketSUSD");
    const market = await PredictionMarketSUSD.deploy(
      m.question,
      m.deadline,
      ["https://google.com"],
      ethers.encodeBytes32String(m.category),
      150,
      deployer.address,
      susdAddress,
      { gasLimit: 50_000_000 }
    );
    await market.waitForDeployment();
    const addr = await market.getAddress();
    console.log(`  Address: ${addr}`);

    // Approve + add liquidity
    const total = ethers.parseEther("500");
    const yesLiq = total * BigInt(100 - m.yesPercent) / 100n;
    const noLiq = total * BigInt(m.yesPercent) / 100n;

    await (await susd.approve(addr, total, { gasLimit: 5_000_000 })).wait();
    await (await market.addLiquidity(yesLiq, noLiq, { gasLimit: 10_000_000 })).wait();
    await (await market.activate({ gasLimit: 5_000_000 })).wait();
    console.log(`  Active! YES:${ethers.formatEther(yesLiq)} NO:${ethers.formatEther(noLiq)}`);

    deployed.push({ address: addr, question: m.question, category: m.category, yesPercent: m.yesPercent, deadline: m.deadline });
  }

  const fs = require("fs");
  fs.writeFileSync("deployments/ai-markets.json", JSON.stringify({ markets: deployed, deployedAt: new Date().toISOString() }, null, 2));
  console.log("\nDone! Saved to deployments/ai-markets.json");
}

main().catch((e) => { console.error(e.message?.slice(0, 300) || e); process.exit(1); });
