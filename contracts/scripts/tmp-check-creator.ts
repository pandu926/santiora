import { ethers } from "hardhat";

async function main() {
  const COORD = "0x9f2DEA7F47bCBec086F1a5fe7c4d909424e8A18B";
  const SCRIPT_CREATOR = "0xE53387e3187147530F6C0C1faFd17066dF63B22E";
  const coord = new ethers.Contract(COORD, [
    "function creatorModule() view returns (address)",
    "function resolverModule() view returns (address)",
  ], ethers.provider);
  const onchainCreator = await coord.creatorModule();
  console.log("coord.creatorModule (on-chain):", onchainCreator);
  console.log("CREATOR in script             :", SCRIPT_CREATOR);
  console.log("MATCH:", onchainCreator.toLowerCase() === SCRIPT_CREATOR.toLowerCase());
  console.log("\nonchainCreator bal:", ethers.formatEther(await ethers.provider.getBalance(onchainCreator)), "STT");
  console.log("scriptCreator  bal:", ethers.formatEther(await ethers.provider.getBalance(SCRIPT_CREATOR)), "STT");
  const minB = new ethers.Contract(onchainCreator, ["function minBalanceForCreate() view returns (uint256)"], ethers.provider);
  try { console.log("onchainCreator.minBalanceForCreate:", ethers.formatEther(await minB.minBalanceForCreate()), "STT"); }
  catch (e: any) { console.log("minBalanceForCreate err:", e.shortMessage || e.message); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
