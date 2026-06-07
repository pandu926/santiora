import { ethers } from "hardhat";
const V4="0xe0Bf8B5E764c8C2081876Ff0E966c289036Fa681";
async function main(){
  const v4=await ethers.getContractAt("SantioraV4", V4);
  const m=await(v4 as any).getMarket(0);
  console.log("status  :", ["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])]);
  console.log("question:", m[0]||"(empty)");
  console.log("odds    :", m[1].toString());
  console.log("deadline:", Number(m[2]) ? new Date(Number(m[2])*1000).toISOString() : "unset");
  console.log("data    :", String(m[7]).slice(0,400)||"(empty)");
  console.log("balance :", ethers.formatEther(await ethers.provider.getBalance(V4)), "STT");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
