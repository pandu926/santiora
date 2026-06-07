import { ethers } from "hardhat";

const COORDINATOR = "0x06d7308C8BC931737F5D448C9a755D84CE23773f";
const REGISTRY = "0xd68d350D6eedE5DbABCd658EBA009583FF28A46B";
const CREATOR = "0x6C94e3Ea5340F9ad5A934d9aB8082e40D2C69783";
const POLL_MS = 5_000;
const MAX_WAIT_MS = 240_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  console.log("Caller:", signer.address);

  const coord = new ethers.Contract(COORDINATOR, [
    "function createMarket(string category) external",
    "function getMarketCount() view returns (uint256)",
    "function getMarket(uint256) view returns (string,uint256,uint256,string,uint8,uint256,string,string)",
    "function getStats() view returns (uint256,uint256,uint256,uint256,uint256)"
  ], signer);

  const registry = new ethers.Contract(REGISTRY, [
    "function getMarketCount() view returns (uint256)"
  ], signer);

  const before = await coord.getMarketCount();
  console.log("Markets before:", before.toString());

  console.log("\n→ Triggering createMarket('crypto')...");
  try {
    const tx = await coord.createMarket("crypto", { gasLimit: 20_000_000n });
    const rc = await tx.wait();
    console.log("  tx:", tx.hash, "status:", rc?.status);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("  FAILED:", msg.slice(0, 200));
    process.exit(1);
  }

  console.log("\nPolling pipeline...");
  const start = Date.now();
  let lastStatus = -1;
  while (Date.now() - start < MAX_WAIT_MS) {
    await sleep(POLL_MS);
    const elapsed = Math.round((Date.now() - start) / 1000);
    const count = await coord.getMarketCount();
    const regCount = await registry.getMarketCount();
    if (count <= before) {
      console.log(`  [${elapsed}s] no new market yet (count=${count})`);
      continue;
    }

    const mid = count - 1n;
    const market = await coord.getMarket(mid);
    const status = Number(market[4]);
    if (status !== lastStatus) {
      console.log(`  [${elapsed}s] mid=${mid} status=${status} q="${(market[0] as string).slice(0, 80)}" odds=${market[1]}`);
      lastStatus = status;
    }

    if (status === 1) {
      console.log("\n=== SUCCESS ===");
      console.log("Question:", market[0]);
      console.log("Odds:", market[1].toString());
      console.log("Deadline:", new Date(Number(market[2]) * 1000).toISOString());
      console.log("Source data:", market[6]);
      console.log("Registry count:", regCount.toString());
      return;
    }
    if (status === 4) {
      console.log("\n=== FAILED ===");
      console.log("Reason payload:", market[0]);
      console.log("Data:", market[6]);
      process.exit(1);
    }
  }

  console.log("\n=== TIMEOUT ===");
  process.exit(1);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
});
