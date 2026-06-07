import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("signer before:",ethers.formatEther(await ethers.provider.getBalance(d.address)),"STT");
  const C=[
    "0x34E639Aa08cE36E22fB5a0bDBa6C4dA18fca529C",
    "0xeFD57cDC804C3F7bA93fD8EA5f0574bcb30DA6bD",
    "0xf13f13Cfb417dD52D9636DE97F6D60BA4D3C6b19",
  ];
  for(const a of C){
    const b=await ethers.provider.getBalance(a);
    if(b>ethers.parseEther("0.01")){
      try{
        const c=new ethers.Contract(a,["function withdraw() external","function owner() view returns(address)"],d);
        const tx=await c.withdraw({gasLimit:100_000n}); await tx.wait();
        console.log(`recovered ${ethers.formatEther(b)} from ${a.slice(0,10)}`);
      }catch(e:any){ console.log(`${a.slice(0,10)} fail: ${e.message?.slice(0,60)}`); }
    }
  }
  console.log("signer after:",ethers.formatEther(await ethers.provider.getBalance(d.address)),"STT");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
