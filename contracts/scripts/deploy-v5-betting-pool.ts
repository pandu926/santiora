import { ethers } from "hardhat";

const SUSD     = "0xB553c0003C3F0419abD358A2edD16191fC86ef90";
const SANTIORA_V5 = "0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await ethers.getContractFactory("V5BettingPool");
  const pool    = await Factory.deploy(SUSD, SANTIORA_V5, { gasLimit: 30_000_000 });
  await pool.waitForDeployment();

  const addr = await pool.getAddress();
  console.log("V5BettingPool deployed:", addr);
  console.log("\nAdd to frontend config:");
  console.log(`  V5_BETTING_POOL = "${addr}"`);
}

main().catch(e => { console.error(e); process.exit(1); });
