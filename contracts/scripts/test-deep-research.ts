/**
 * test-deep-research.ts — Deep research loop: gather → vote → loop/create
 *
 * Watch event-driven pipeline:
 *   DataResult/DataFeedback → VoteResult → ResearchLoop (atau) MarketCreated
 */
import { ethers } from "hardhat";

const POLL=5000, MAX=600_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] Deep Research: gather → vote(3 LLM) → loop/create`);

  const F=await ethers.getContractFactory("TestDeepResearch");
  const c=await F.deploy({gasLimit:100_000_000n}); await c.waitForDeployment();
  const addr=await c.getAddress();
  console.log(`[${ts()}] contract: ${addr}`);

  // Fund 4 STT — cukup untuk ~2 round (data + 3 vote) + create
  await(await d.sendTransaction({to:addr,value:ethers.parseEther("4"),gasLimit:100_000n})).wait();

  const tx=await(c as any).start({gasLimit:150_000_000n}); await tx.wait();
  console.log(`[${ts()}] research started (round 1)\n`);

  const iface=(c as any).interface;
  const t0=Date.now();
  let lastBlock=(await ethers.provider.getBlockNumber());
  const seen=new Set<string>();

  while(!(await(c as any).marketDone())&&Date.now()-t0<MAX){
    await sleep(POLL);
    const cur=await ethers.provider.getBlockNumber();
    if(cur<=lastBlock) continue;
    let logs:any[]=[];
    try{ logs=await ethers.provider.send("eth_getLogs",[{fromBlock:"0x"+(lastBlock+1).toString(16),toBlock:"0x"+cur.toString(16),address:addr}]); }
    catch{ lastBlock=cur; continue; }
    lastBlock=cur;

    for(const log of logs){
      let p:any=null; try{p=iface.parseLog({topics:log.topics,data:log.data});}catch{}
      if(!p) continue;
      const key=log.transactionHash+log.logIndex; if(seen.has(key))continue; seen.add(key);
      const e=`+${Math.round((Date.now()-t0)/1000)}s`;
      const a=p.args.map((x:any)=>typeof x==="bigint"?x.toString():x);
      if(p.name==="DataResult")   console.log(`[${ts()}] ${e}  DATA   r${a[0]} [${a[1]}] status=${a[2]} ${a[3]}chars`);
      if(p.name==="DataFeedback") console.log(`[${ts()}] ${e}  FEEDBK r${a[0]} ${a[1]}`);
      if(p.name==="VoteResult")   console.log(`[${ts()}] ${e}  VOTE   r${a[0]} yes=${a[1]} no=${a[2]} → ${a[3]}`);
      if(p.name==="ResearchLoop") console.log(`[${ts()}] ${e}  LOOP   → r${a[0]}: ${a[1]}`);
      if(p.name==="MarketCreated")console.log(`[${ts()}] ${e}  ✓ MARKET: "${a[0]}" odds=${a[1]}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  const done=await(c as any).marketDone();
  const round=Number(await(c as any).round());
  const ctx=String(await(c as any).dataContext());
  console.log(`marketDone : ${done}`);
  console.log(`final round: ${round}`);
  console.log(`data context: ${ctx}`);
  if(done){
    console.log(`question : ${await(c as any).marketQuestion()}`);
    console.log(`odds     : ${await(c as any).marketOdds()}`);
  }
  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("4")-await ethers.provider.getBalance(addr))} STT`);

  // Recover sisa dana
  try {
    const tx=await(c as any).withdraw({gasLimit:100_000n}); await tx.wait();
    console.log(`recovered remaining balance → signer`);
  } catch {}
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});