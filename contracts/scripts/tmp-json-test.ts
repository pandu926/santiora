import { ethers } from "hardhat";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const [d]=await ethers.getSigners();
  const F=await ethers.getContractFactory("TestDomainExplorer");
  const c=await F.deploy({gasLimit:60_000_000n}); await c.waitForDeployment();
  const addr=await c.getAddress();
  await(await d.sendTransaction({to:addr,value:ethers.parseEther("0.5"),gasLimit:100_000n})).wait();
  // JSON API test - crypto price (agent berbeda dari scraper)
  const tx=await(c as any).testJson("btc","https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd","bitcoin.usd",{gasLimit:60_000_000n});
  await tx.wait();
  console.log("JSON request sent, polling 90s...");
  const t0=Date.now();
  while(Date.now()-t0<90000){
    await sleep(5000);
    const rid=await(c as any).reqIds(0);
    if(await(c as any).received(rid)){
      const st=Number(await(c as any).statusOf(rid));
      const res=String(await(c as any).result(rid));
      console.log(`JSON API: status=${st} (${st===2?'SUCCESS':'FAIL'}) result="${res}"`);
      console.log(st===2 ? "→ Platform HIDUP. Scraper agent yang down." : "→ Platform/JSON juga bermasalah");
      return;
    }
    console.log(`+${Math.round((Date.now()-t0)/1000)}s waiting...`);
  }
  console.log("JSON API timeout → platform-wide issue");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
