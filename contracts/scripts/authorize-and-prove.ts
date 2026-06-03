import { ethers } from "hardhat";

const REGISTRY = "0xd68d350D6eedE5DbABCd658EBA009583FF28A46B";
const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const CREATOR = "0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F";

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const reg = new ethers.Contract(REGISTRY, [
    "function authorizedRegistrars(address) view returns (bool)",
    "function addRegistrar(address) external",
    "function owner() view returns (address)",
  ], signer);
  const coord = await ethers.getContractAt("SantioraFinalV3", COORD);

  console.log("registry.owner:", await reg.owner());
  console.log("signer:        ", signer.address);
  console.log("coord authorized?", await reg.authorizedRegistrars(COORD));

  if (!(await reg.authorizedRegistrars(COORD))) {
    console.log("\n→ addRegistrar(coord)...");
    const tx = await reg.addRegistrar(COORD, { gasLimit: 5_000_000n });
    await tx.wait();
    console.log("   tx:", tx.hash, "authorized now:", await reg.authorizedRegistrars(COORD));
  }

  // canCreate after interval already passed (1 min)
  const can = await (coord as any)["canCreateMarket()"]();
  console.log("\ncanCreate:", can[0], can[1]);
  if (!can[0]) {
    console.log("Waiting 65s for interval...");
    await new Promise(r => setTimeout(r, 65000));
  }

  console.log("\n→ createMarket() ...");
  const tx2 = await (coord as any)["createMarket()"]({ gasLimit: 8_000_000n });
  console.log("   tx:", tx2.hash);
  const rec = await tx2.wait();
  console.log("   block:", rec.blockNumber, "status:", rec.status);

  const count = await (coord as any).getMarketCount();
  const mid = count - 1n;
  console.log("\nnew marketId:", mid.toString());
  const mk = await (coord as any).getMarket(mid);
  console.log("  status:", mk[4].toString(), "(0=Creating)");
  console.log("  → now polling for finalize (5 min)...\n");

  const start = Date.now();
  while (Date.now() - start < 300000) {
    await new Promise(r => setTimeout(r, 15000));
    const m = await (coord as any).getMarket(mid);
    const s = Number(m[4]);
    const sn = ["Creating","Active","Resolving","Resolved","Failed"][s] ?? "?";
    const el = Math.round((Date.now()-start)/1000);
    console.log(`  [${el}s] status=${sn} q="${m[0].slice(0,90)}" odds=${m[1]}`);
    if (s === 1) {
      console.log("\n=== AUTONOMOUS V3 PIPELINE PROVEN END-TO-END ===");
      console.log("question:", m[0]);
      console.log("odds:    ", m[1].toString());
      console.log("deadline:", new Date(Number(m[2])*1000).toISOString());
      console.log("category:", m[3]);
      console.log("data:    ", m[7]);
      const regCount = await reg.connect(ethers.provider).getFunction("getMarketCount").staticCall();
      console.log("\nregistry now has", regCount.toString(), "markets");
      return;
    }
    if (s === 4) {
      console.log("\n=== STILL FAILED — different reason ===");
      return;
    }
  }
  console.log("\nTimeout");
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
