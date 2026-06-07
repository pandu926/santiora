/**
 * test-pipeline-full.ts
 *
 * Pipeline final: 3 proven sources (parallel, max 120s) → LLM inference.
 * Kalau >120s / ≥1 source sukses → langsung infer.
 */

import { ethers } from "hardhat";

const POLL=5000, MAX_SOURCE=120_000, MAX_LLM=120_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] Pipeline: 3 sources → LLM inference`);

  const F=await ethers.getContractFactory("TestRichContext");
  const c=await F.deploy({gasLimit:100_000_000n});await c.waitForDeployment();
  const addr=await c.getAddress();
  const dep=await(c as any).dep();
  console.log(`[${ts()}] ${addr} | ${ethers.formatEther(dep)} STT/call | ~${ethers.formatEther(dep*4n)} total`);

  await(await d.sendTransaction({to:addr,value:ethers.parseEther("3"),gasLimit:100_000n})).wait();

  // 3 query — domain teruji: ESPN, Guardian, Livescore
  console.log(`\n=== LAYER 1: 3 keyword queries ===`);
  const tx=await(c as any).gatherAll({gasLimit:200_000_000n});await tx.wait();

  const t0=Date.now();let done=0,prevDone=0;
  const total=Number(await(c as any).reqCount());
  console.log(`Waiting max ${MAX_SOURCE/1000}s per source...`);

  while(done<total&&Date.now()-t0<MAX_SOURCE){await sleep(POLL);
    done=0;for(let i=0;i<total;i++)if(await(c as any).received(await(c as any).reqIds(i)))done++;
    if(done!==prevDone){console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  ${done}/${total}`);prevDone=done;}
  }

  let succ=0,ctxStr="";
  for(let i=0;i<total;i++){
    const rid=await(c as any).reqIds(i),lbl=await(c as any).label(rid);
    const got=await(c as any).received(rid),st=got?Number(await(c as any).statusOf(rid)):-1;
    const res=got?String(await(c as any).result(rid)):"";
    console.log(`\n[${lbl}] ${st===2?'SUCCESS':st===3?'FAILED':got?'?':'timeout'}`);
    if(res){console.log(`  ${res.slice(0,500)}`);if(st===2){succ++;ctxStr+=res+"\n";}}
  }

  if(!succ){console.log(`\nNo data`);return;}
  console.log(`\n  ${succ}/${total} success, ~${ctxStr.length} chars`);

  console.log(`\n=== LAYER 2: LLM Inference ===`);
  const tx2=await(c as any).infer({gasLimit:120_000_000n});await tx2.wait();
  console.log(`[${ts()}] LLM request sent, waiting...`);
  const t2=Date.now();
  while(!(await(c as any).llmDone())&&Date.now()-t2<MAX_LLM){await sleep(POLL);
    console.log(`[${ts()}] +${Math.round((Date.now()-t2)/1000)}s`);}

  if(await(c as any).llmDone()){
    const q=String(await(c as any).llmQuestion()),o=Number(await(c as any).llmOdds()),dl=Number(await(c as any).llmDeadlineHours());
    console.log(`\n========================================`);
    console.log(`  question: "${q}"`);
    console.log(`  odds: ${o}  |  deadline: ${dl}h`);
    console.log(`========================================`);
    const hasSkip=q.toLowerCase().includes('skip');
    console.log(`\n  Verdict: ${hasSkip?'SKIP (data insufficient)':'MARKET VALID'}`);
    if(!hasSkip)console.log(`  LLM bikin market kaya dari ${succ} sumber context nyata`);
  }

  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("3")-await ethers.provider.getBalance(addr))} STT`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});