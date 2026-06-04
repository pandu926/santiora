/**
 * test-deep-resolver.ts — Resolve "Arsenal win UCL final vs PSG?" via deep research
 *
 * Skenario: market PSG vs Arsenal final (2026-05-30) berakhir 1-1, PSG menang
 * 4-3 penalti. Skor 1-1 menyesatkan. Resolver harus gather lebih dalam untuk
 * tentukan pemenang sebenarnya (NO — Arsenal kalah).
 */
import { ethers } from "hardhat";

const POLL=5000, MAX=600_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] Deep Resolver — resolve UCL final market`);

  const F=await ethers.getContractFactory("TestDeepResolver");
  const c=await F.deploy({gasLimit:120_000_000n}); await c.waitForDeployment();
  const addr=await c.getAddress();
  console.log(`[${ts()}] contract: ${addr}`);
  console.log(`[${ts()}] MARKET: ${await (c as any).MARKET_Q()}`);
  console.log(`[${ts()}] GROUND TRUTH: PSG won 4-3 on penalties (1-1 reg) → Arsenal LOST → answer NO\n`);

  await(await d.sendTransaction({to:addr,value:ethers.parseEther("4"),gasLimit:100_000n})).wait();

  const tx=await(c as any).start({gasLimit:150_000_000n}); await tx.wait();
  console.log(`[${ts()}] resolution research started\n`);

  const iface=(c as any).interface;
  const t0=Date.now();
  let lastBlock=await ethers.provider.getBlockNumber();
  const seen=new Set<string>();

  while(!(await(c as any).resolveDone())&&Date.now()-t0<MAX){
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
      if(p.name==="DataResult")   console.log(`[${ts()}] ${e}  DATA   r${a[0]} [${a[1]}] ${a[3]}chars`);
      if(p.name==="DataFeedback") console.log(`[${ts()}] ${e}  FEEDBK r${a[0]} ${a[1]}`);
      if(p.name==="VoteResult")   console.log(`[${ts()}] ${e}  VOTE   r${a[0]} yes=${a[1]} no=${a[2]} → ${a[3]}`);
      if(p.name==="ResearchLoop") console.log(`[${ts()}] ${e}  LOOP   ${a[1]}`);
      if(p.name==="Resolved")     console.log(`[${ts()}] ${e}  ✓ RESOLVED: ${a[0]} confidence=${a[1]}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  const done=await(c as any).resolveDone();
  console.log(`resolveDone : ${done}`);
  console.log(`final round : ${await(c as any).round()}`);
  console.log(`data context: ${String(await(c as any).dataContext()).slice(0,400)}`);
  if(done){
    const out=String(await(c as any).outcome());
    const conf=Number(await(c as any).confidence());
    console.log(`\noutcome   : ${out}`);
    console.log(`confidence: ${conf}`);
    console.log(`raw       : ${String(await(c as any).resolveRaw()).slice(0,300)}`);
    console.log(`\n${out==="NO" ? "✓ CORRECT — Arsenal lost (PSG won on penalties)" : "✗ WRONG — should be NO"}`);
  }

  try{ await(await(c as any).withdraw({gasLimit:100_000n})).wait(); console.log(`\nrecovered remaining balance`); }catch{}
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});