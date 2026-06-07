import { ethers } from "hardhat";

const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
const CREATOR = "0xE53387e3187147530F6C0C1faFd17066dF63B22E";

async function main(): Promise<void> {
  const coord = await ethers.getContractAt("SantioraFinalV3", COORD);
  const creator = await ethers.getContractAt("SantioraV3Creator", CREATOR);

  const mk = await (coord as any).getMarket(0);
  console.log("=== Market #0 final state ===");
  console.log("question:", mk[0]);
  console.log("odds:    ", mk[1].toString());
  console.log("deadline:", mk[2].toString(), "(", new Date(Number(mk[2])*1000).toISOString(), ")");
  console.log("category:", mk[3]);
  console.log("status:  ", mk[4].toString());
  console.log("outcome: ", mk[5]);
  console.log("data:    ", mk[7]);

  const cur = await ethers.provider.getBlockNumber();
  console.log("\nScan last 2000 blocks for events on coord+creator...");
  const FROM = cur - 999;

  const coordLogs = await ethers.provider.getLogs({ address: COORD, fromBlock: FROM, toBlock: cur });
  const creatorLogs = await ethers.provider.getLogs({ address: CREATOR, fromBlock: FROM, toBlock: cur });
  console.log("coord logs:", coordLogs.length, "| creator logs:", creatorLogs.length);

  const coordIface = coord.interface;
  const creatorIface = creator.interface;
  for (const log of [...coordLogs, ...creatorLogs].sort((a,b) => a.blockNumber - b.blockNumber)) {
    let parsed = null;
    try { parsed = coordIface.parseLog(log); } catch {}
    if (!parsed) { try { parsed = creatorIface.parseLog(log); } catch {} }
    if (parsed) {
      console.log(`  blk=${log.blockNumber} [${log.address.slice(0,8)}] ${parsed.name}`,
        parsed.args.map((a: unknown) => typeof a === "bigint" ? a.toString() : (typeof a === "string" && a.length > 100 ? a.slice(0,100)+"..." : a)));
    } else {
      console.log(`  blk=${log.blockNumber} [${log.address.slice(0,8)}] (unparsed) ${log.topics[0]?.slice(0,10)}`);
    }
  }
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
