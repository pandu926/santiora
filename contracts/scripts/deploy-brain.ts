import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SantioraBrain with:", deployer.address);

  const F = await ethers.getContractFactory("SantioraBrain");
  const c = await F.deploy({ gasLimit: 50000000 });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("SantioraBrain deployed:", addr);

  // Fund minimal
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("0.5"), gasLimit: 50000 })).wait();
  console.log("Funded 0.5 STT");

  // Test 1: AI thinks and creates market autonomously
  console.log("\n--- Test: autonomousCreate (crypto) ---");
  const tx1 = await c.autonomousCreate("Bitcoin and crypto markets June 2026", { value: ethers.parseEther("0.24"), gasLimit: 50000000 });
  const r1 = await tx1.wait();
  console.log("Status:", r1!.status === 1 ? "OK" : "FAIL", "| gas:", r1!.gasUsed.toString());

  // Test 2: AI thinks freely
  console.log("\n--- Test: think (free reasoning) ---");
  const tx2 = await c.think("What is the most interesting prediction market you could create about the 2026 Champions League Final?", { value: ethers.parseEther("0.24"), gasLimit: 50000000 });
  const r2 = await tx2.wait();
  console.log("Status:", r2!.status === 1 ? "OK" : "FAIL", "| gas:", r2!.gasUsed.toString());

  // Test 3: JSON API fetch
  console.log("\n--- Test: fetchData (CoinGecko BTC price) ---");
  const tx3 = await c.fetchData(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "$.bitcoin.usd",
    { value: ethers.parseEther("0.12"), gasLimit: 50000000 }
  );
  const r3 = await tx3.wait();
  console.log("Status:", r3!.status === 1 ? "OK" : "FAIL", "| gas:", r3!.gasUsed.toString());

  console.log("\nSantioraBrain:", addr);
  console.log("3 requests sent. Monitor with getThought(0), getThought(1), getThought(2)");
}

main().catch((e) => { console.error(e.message?.slice(0, 200)); process.exit(1); });
