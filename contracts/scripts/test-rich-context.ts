import { ethers } from "hardhat";

const POLL=5000, MAX=420_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] 6 queries across proven domains + new sites`);

  const F = await ethers.getContractFactory("TestRichContext");
  const c = await F.deploy({gasLimit:100_000_000n}); await c.waitForDeployment();
  const addr=await c.getAddress();
  const dep=await(c as any).dep();
  console.log(`[${ts()}] contract: ${addr} | ${ethers.formatEther(dep)} STT/call | ~${ethers.formatEther(dep*7n)} total`);

  await(await d.sendTransaction({to:addr,value:ethers.parseEther("5"),gasLimit:100_000n})).wait();
  const tx=await(c as any).gatherAll({gasLimit:200_000_000n}); await tx.wait();
  console.log(`[${ts()}] 6 queries sent`);

  const t0=Date.now();let done=0;
  while(done<6&&Date.now()-t0<MAX){await sleep(POLL);done=0;
    const n=Number(await(c as any).reqCount());
    for(let i=0;i<n;i++)if(await(c as any).received(await(c as any).reqIds(i)))done++;
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  ${done}/6`);
  }

  console.log(`\n--- RESULTS ---`);
  let ctx=0, succ=0; const n=Number(await(c as any).reqCount());
  for(let i=0;i<n;i++){
    const rid=await(c as any).reqIds(i),lbl=await(c as any).label(rid);
    const got=await(c as any).received(rid),st=got?Number(await(c as any).statusOf(rid)):-1;
    const res=got?String(await(c as any).result(rid)):"";
    console.log(`\n[${lbl}] ${st===2?'SUCCESS':st===3?'FAILED':'?'}  (${res.length} chars)`);
    if(res){console.log(`  ${res.slice(0,500)}${res.length>500?'...':''}`);if(st===2){ctx+=res.length;succ++;}}
  }
  if(!succ){console.log(`\nNo sources succeeded`);return;}
  console.log(`\n  ${succ}/6 sources, ${ctx} chars context`);

  console.log(`\n--- LLM Inference ---`);
  const tx2=await(c as any).infer({gasLimit:120_000_000n}); await tx2.wait();
  while(!(await(c as any).llmDone())&&Date.now()-t0<MAX){await sleep(POLL);console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  LLM...`);}
  if(await(c as any).llmDone()){
    const q=String(await(c as any).llmQuestion()),o=Number(await(c as any).llmOdds()),dl=Number(await(c as any).llmDeadlineHours());
    console.log(`\n  question: ${q}\n  odds: ${o}  deadline: ${dl}h`);
    console.log(`\n  ${q.toLowerCase().includes('skip')?'SKIP - data insufficient':'VALID - rich context market'}`);
  }
  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("5")-await ethers.provider.getBalance(addr))} STT`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});