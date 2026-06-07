import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  // V3 Creator on-chain — punya withdraw(uint256) onlyOwner
  const CREATOR="0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F";
  const bal=await ethers.provider.getBalance(CREATOR);
  console.log("creator balance:",ethers.formatEther(bal),"STT");
  const c=new ethers.Contract(CREATOR,[
    "function owner() view returns (address)",
    "function withdraw(uint256) external",
  ],d);
  try {
    const owner=await c.owner();
    console.log("creator owner:",owner,"| me:",d.address,"| match:",owner.toLowerCase()===d.address.toLowerCase());
    if(owner.toLowerCase()===d.address.toLowerCase() && bal>ethers.parseEther("0.1")){
      const amt=bal-ethers.parseEther("0.05");
      console.log("withdrawing",ethers.formatEther(amt),"STT...");
      const tx=await c.withdraw(amt,{gasLimit:200_000n}); await tx.wait();
      console.log("recovered! new signer balance:",ethers.formatEther(await ethers.provider.getBalance(d.address)),"STT");
    }
  } catch(e:any){ console.log("err:",e.message?.slice(0,120)); }
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
