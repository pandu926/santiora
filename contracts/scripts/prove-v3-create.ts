import { ethers } from "hardhat";

const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const CREATOR = "0xE53387e3187147530F6C0C1faFd17066dF63B22E";

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const coord = await ethers.getContractAt("SantioraFinalV3", COORD);
  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);

  const beforeCount = await (coord as any).getMarketCount();
  console.log("\nBefore — marketCount:", beforeCount.toString());
  const cat = await (coord as any).getNextCategory();
  console.log("Next category:", cat);
  const can = await (coord as any)["canCreateMarket()"]();
  console.log("canCreate:", can[0], can[1]);

  if (!can[0]) {
    console.log("Cannot create — abort");
    return;
  }

  console.log("\n→ Calling coord.createMarket() (no-arg, owner-triggered)...");
  const tx = await (coord as any)["createMarket()"]({ gasLimit: 8_000_000n });
  console.log("   tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("   block:", receipt.blockNumber, "status:", receipt.status);

  console.log("\nDecoding events...");
  const coordIface = coord.interface;
  const creatorIface = creator.interface;
  for (const log of receipt.logs) {
    let parsed = null;
    try { parsed = coordIface.parseLog(log); } catch {}
    if (!parsed) { try { parsed = creatorIface.parseLog(log); } catch {} }
    if (parsed) {
      console.log(`  [${log.address.slice(0,8)}] ${parsed.name}`,
        parsed.args.map((a: unknown) => typeof a === "bigint" ? a.toString() : a));
    } else {
      console.log(`  [${log.address.slice(0,8)}] (unparsed) topic0=${log.topics[0]?.slice(0,10)}`);
    }
  }

  const afterCount = await (coord as any).getMarketCount();
  console.log("\nAfter — marketCount:", afterCount.toString());

  if (afterCount > beforeCount) {
    const newId = afterCount - 1n;
    const mk = await (coord as any).getMarket(newId);
    console.log(`\nMarket #${newId}:`);
    console.log("  question:  ", mk[0]);
    console.log("  odds:      ", mk[1].toString());
    console.log("  deadline:  ", mk[2].toString());
    console.log("  category:  ", mk[3]);
    console.log("  status:    ", mk[4].toString(), "(0=Creating, 1=Active, 2=Resolving, 3=Resolved, 4=Failed)");
  }

  console.log("\nCreator balance after:", ethers.formatEther(await ethers.provider.getBalance(CREATOR)), "STT");
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
