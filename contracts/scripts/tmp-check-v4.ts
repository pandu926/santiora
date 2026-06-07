import { ethers } from "hardhat";
async function main(){
  const v4 = await ethers.getContractAt("SantioraV4", "0xF86F54a452BDbe48b296A75cB75FEb603b465361");
  const count = Number(await (v4 as any).getMarketCount());
  console.log("marketCount:", count);
  if (count > 0) {
    const m = await (v4 as any).getMarket(0);
    console.log("status:", ["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])]);
    console.log("question:", m[0] || "(empty)");
    console.log("odds:", m[1].toString());
    console.log("data:", String(m[7]).slice(0,300) || "(empty)");
  }
  console.log("balance:", ethers.formatEther(await ethers.provider.getBalance("0xF86F54a452BDbe48b296A75cB75FEb603b465361")), "STT");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
