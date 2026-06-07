import { ethers } from "hardhat";

const POLL=5000,MAX_SRC=180_000,MAX_LLM=120_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] 2 proven sources → LLM inference`);

  const F=await ethers.getContractFactory("TestFinalPipeline");
  const c=await F.deploy({gasLimit:100_000_000n});await c.waitForDeployment();
  const addr=await c.getAddress(),dep=await(c as any).dep();
  console.log(`[${ts()}] ${addr} | ${ethers.formatEther(dep)} STT/call | ~${ethers.formatEther(dep*3n)} total`);

  await(await d.sendTransaction({to:addr,value:ethers.parseEther("2"),gasLimit:100_000n})).wait();

  console.log(`\n=== LAYER 1: 2 sources (ESPN + Guardian) ===`);
  const tx=await(c as any).gatherAll({gasLimit:200_000_000n});await tx.wait();

  const t0=Date.now();let done=0;
  while(done<2&&Date.now()-t0<MAX_SRC){await sleep(POLL);
    done=0;for(let i=0;i<2;i++)if(await(c as any).received(await(c as any).reqIds(i)))done++;
    const e=Math.round((Date.now()-t0)/1000);if(e%10===0)console.log(`[${ts()}] +${e}s  ${done}/2`);
  }

  let succ=0,ctxChars=0;
  for(let i=0;i<2;i++){
    const rid=await(c as any).reqIds(i),lbl=await(c as any).label(rid);
    const got=await(c as any).received(rid),st=got?Number(await(c as any).statusOf(rid)):-1;
    const res=got?String(await(c as any).result(rid)):"";
    console.log(`\n[${lbl}] ${st===2?'SUCCESS':st===3?'FAILED':got?'?':'timeout'}`);
    if(res){console.log(`  ${res.slice(0,600)}`);if(st===2){succ++;ctxChars+=res.length;}}
  }
  if(!succ){console.log(`\nNo data`);return;}
  console.log(`\n  ${succ}/2 success, ${ctxChars} chars`);

  console.log(`\n=== LAYER 2: LLM Inference ===`);
  const tx2=await(c as any).infer({gasLimit:120_000_000n});await tx2.wait();
  const t2=Date.now();
  while(!(await(c as any).llmDone())&&Date.now()-t2<MAX_LLM){await sleep(POLL);
    console.log(`[${ts()}] +${Math.round((Date.now()-t2)/1000)}s`);}

  if(await(c as any).llmDone()){
    const q=String(await(c as any).llmQuestion());
    const o=Number(await(c as any).llmOdds()),dl=Number(await(c as any).llmDeadlineHours());
    console.log(`\n========================================`);
    console.log(`  question: "${q}"`);
    console.log(`  odds: ${o}  |  deadline: ${dl}h`);
    console.log(`========================================`);
    console.log(`\n  ${q.toLowerCase().includes('skip')?'SKIP - insufficient':'VALID MARKET - rich context'}`);
  }

  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("2")-await ethers.provider.getBalance(addr))} STT`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});