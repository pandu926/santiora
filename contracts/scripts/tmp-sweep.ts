import { ethers } from "hardhat";
const CONTRACTS = [
  "0xAeEFfA1B78512E252978F07f2e87271c0e5E118d", // TestDeepResearch (failed deploy, maybe funded)
  "0xea5cF276ee63bA5fe39d831993392B53D77a1bAF", // TestFinalPipeline
  "0xBBE77781Df1b5301C1A97610Ee0fF524e7770Be7",
  "0x94862D73949f381dC8a861bdf873226a02896690", // TestRichContext
  "0x1aD836E807986675376B12AA901dBcbdD88F33C1", // TestMassiveGather
  "0xae0A13c4897F70AEA5E7350Ed6fEF0Fe41126a7b", // TestRichDataGather
];
async function main(){
  let total=0n;
  for(const a of CONTRACTS){
    const b=await ethers.provider.getBalance(a);
    if(b>0n){ console.log(`${a.slice(0,12)}... : ${ethers.formatEther(b)} STT`); total+=b; }
  }
  console.log(`\nTotal locked in test contracts: ${ethers.formatEther(total)} STT`);
  console.log("(Test contracts only have receive(), no withdraw — dana tidak bisa ditarik)");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
