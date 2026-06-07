import { ethers } from "hardhat";

async function main() {
  const COORD = "0x06d7308C8BC931737F5D448C9a755D84CE23773f";
  const [signer] = await ethers.getSigners();
  console.log("Caller:", signer.address);
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("Caller balance:", ethers.formatEther(bal), "STT");

  const coord = new ethers.Contract(COORD, [
    "function createMarket(string category) external",
    "function getStats() view returns (uint256,uint256,uint256,uint256,uint256)"
  ], signer);

  const categories = ["crypto", "finance"];
  for (const cat of categories) {
    console.log(`\n→ Triggering createMarket("${cat}")...`);
    try {
      const tx = await coord.createMarket(cat, { gasLimit: 20_000_000n });
      console.log("  tx:", tx.hash);
      const rc = await tx.wait();
      console.log("  block:", rc?.blockNumber, "status:", rc?.status);
    } catch (e: any) {
      console.error("  FAILED:", e.shortMessage || e.message);
    }
  }

  const s = await coord.getStats();
  console.log("\nCoordinator stats: total=", s[0].toString(), "created=", s[1].toString(), "failed=", s[3].toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
