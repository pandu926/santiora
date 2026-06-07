import { ethers } from "hardhat";
const POLL=5000, MAX=300_000;
const V4="0xe0Bf8B5E764c8C2081876Ff0E966c289036Fa681";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function ts(){return new Date().toISOString().slice(11,19)}
async function main(){
  const v4=await ethers.getContractAt("SantioraV4", V4);
  const iface=(v4 as any).interface;
  let lastBlock=await ethers.provider.getBlockNumber()-5;
  const t0=Date.now();
  console.log(`[${ts()}] Watching V4 pipeline...\n`);
  let done=false;
  while(!done && Date.now()-t0<MAX){
    await sleep(POLL);
    const cur=await ethers.provider.getBlockNumber();
    if(cur<=lastBlock) continue;
    let logs:any[]=[];
    try{logs=await ethers.provider.send("eth_getLogs",[{fromBlock:"0x"+(lastBlock+1).toString(16),toBlock:"0x"+cur.toString(16),address:V4}]);}catch{lastBlock=cur;continue;}
    lastBlock=cur;
    for(const log of logs){
      let p:any=null;try{p=iface.parseLog({topics:log.topics,data:log.data});}catch{}
      if(!p)continue;
      const e=`+${Math.round((Date.now()-t0)/1000)}s`;
      const a=p.args.map((x:any)=>typeof x==="bigint"?x.toString():x);
      if(p.name==="DataGathered") console.log(`[${ts()}] ${e}  DATA   r${a[1]} [${a[2]}] ${a[4]}ch`);
      if(p.name==="DataFeedback") console.log(`[${ts()}] ${e}  FEEDBK r${a[1]} ${a[2]}`);
      if(p.name==="VoteResult")   console.log(`[${ts()}] ${e}  VOTE   r${a[1]} yes=${a[2]} no=${a[3]} -> ${a[4]}`);
      if(p.name==="ResearchLoop") console.log(`[${ts()}] ${e}  LOOP   r${a[1]}: ${a[2]}`);
      if(p.name==="MarketActive") {console.log(`[${ts()}] ${e}  ACTIVE "${a[1]}" odds=${a[2]}`);done=true;}
      if(p.name==="PipelineFailed"){console.log(`[${ts()}] ${e}  FAILED ${a[1]}`);done=true;}
      if(p.name==="Decision")     console.log(`[${ts()}] ${e}  DECISION ${a[1]}: ${String(a[2]).slice(0,150)}`);
    }
  }
  // Final state
  const m=await(v4 as any).getMarket(0);
  console.log(`\n=== Market #0 ===`);
  console.log(`  status  : ${["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])]}`);
  console.log(`  question: ${m[0]||"(empty)"}`);
  console.log(`  odds    : ${m[1]}`);
  console.log(`  data    : ${String(m[7]).slice(0,300)}`);
  console.log(`  balance : ${ethers.formatEther(await ethers.provider.getBalance(V4))} STT`);
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
