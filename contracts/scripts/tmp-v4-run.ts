import { ethers } from "hardhat";
const POLL=5000, MAX=300_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const [d]=await ethers.getSigners();
  console.log("bal:", ethers.formatEther(await ethers.provider.getBalance(d.address)));

  const Reg=await ethers.getContractFactory("MarketRegistryV2");
  const reg=await Reg.deploy({gasLimit:30_000_000n}); await reg.waitForDeployment();
  const V4=await ethers.getContractFactory("SantioraV4");
  const v4=await V4.deploy(await reg.getAddress(), {gasLimit:200_000_000n}); await v4.waitForDeployment();
  const addr=await v4.getAddress();
  console.log("v4:", addr);

  await(await reg.addRegistrar(addr,{gasLimit:5_000_000n})).wait();
  await(await d.sendTransaction({to:addr,value:ethers.parseEther("5"),gasLimit:5_000_000n})).wait();
  await(await(v4 as any).updateRules([0n,86400n,604800n,5n,70n,3],{gasLimit:5_000_000n})).wait();

  const tx=await(v4 as any)["createMarket(string)"]("sports",{gasLimit:200_000_000n});
  const rec=await tx.wait();
  console.log("create tx:", rec.blockNumber, "gas:", rec.gasUsed.toString());

  // Watch
  const iface=(v4 as any).interface;
  let lastBlock=rec.blockNumber;
  const t0=Date.now(); let done=false;
  while(!done&&Date.now()-t0<MAX){
    await sleep(POLL);
    const cur=await ethers.provider.getBlockNumber();
    if(cur<=lastBlock)continue;
    let logs:any[]=[];
    try{logs=await ethers.provider.send("eth_getLogs",[{fromBlock:"0x"+(lastBlock+1).toString(16),toBlock:"0x"+cur.toString(16),address:addr}]);}catch{lastBlock=cur;continue;}
    lastBlock=cur;
    for(const log of logs){
      let p:any=null;try{p=iface.parseLog({topics:log.topics,data:log.data});}catch{}
      if(!p)continue;
      const e=`+${Math.round((Date.now()-t0)/1000)}s`;
      const a=p.args.map((x:any)=>typeof x==="bigint"?x.toString():x);
      if(p.name==="DataGathered") console.log(`${e} DATA r${a[1]} [${a[2]}] ${a[4]}ch`);
      if(p.name==="DataFeedback") console.log(`${e} FEEDBK r${a[1]} ${a[2]}`);
      if(p.name==="VoteResult")   console.log(`${e} VOTE r${a[1]} yes=${a[2]} no=${a[3]} -> ${a[4]}`);
      if(p.name==="ResearchLoop") console.log(`${e} LOOP r${a[1]}: ${a[2]}`);
      if(p.name==="MarketActive") {console.log(`${e} ACTIVE "${a[1]}" odds=${a[2]}`);done=true;}
      if(p.name==="PipelineFailed"){console.log(`${e} FAILED ${a[1]}`);done=true;}
      if(p.name==="Decision")     console.log(`${e} DECISION ${a[1]}`);
    }
  }
  const m=await(v4 as any).getMarket(0);
  console.log(`\nFINAL: ${["Creating","Active","Resolving","Resolved","Failed"][Number(m[4])]}`);
  console.log(`Q: ${m[0]||"(empty)"}`);
  console.log(`odds: ${m[1]} data: ${String(m[7]).slice(0,250)}`);
  console.log(`bal: ${ethers.formatEther(await ethers.provider.getBalance(addr))}`);
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
