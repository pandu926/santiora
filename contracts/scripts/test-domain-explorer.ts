/**
 * test-domain-explorer.ts — Phase 1: Uji 10+ domain, 2 query/batch, sequential
 *
 * Strategy: 1 domain = 1 kontrak = 2 query sequential. Tunggu callback, catat hasil.
 * Lebih simpel & reliable dibanding 1 kontrak besar untuk semua domain.
 */
import { ethers } from "hardhat";

const POLL=5000, MAX_SRC=180_000;
function ts(){return new Date().toISOString().slice(11,19)}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

interface DomainTest {
  name: string;
  domain: string;
  q1: string;
  q2: string;
}

const DOMAINS: DomainTest[] = [
  { name:"fotmob",     domain:"fotmob.com",      q1:"latest football match results with scores and dates",  q2:"football league standings table points positions" },
  { name:"fbref",      domain:"fbref.com",        q1:"recent football match results scores",                q2:"team statistics xG possession passing accuracy" },
  { name:"transfermkt",domain:"transfermarkt.com", q1:"latest football match results and scores",            q2:"player market values and recent form ratings" },
  { name:"sofascore",  domain:"sofascore.com",     q1:"finished football match results final scores",        q2:"head to head record between teams" },
  { name:"goal",       domain:"goal.com",          q1:"latest football news results headlines",              q2:"upcoming football fixtures schedule matches" },
  { name:"whoscored",  domain:"whoscored.com",     q1:"recent football match results with ratings",          q2:"player and team statistics performance data" },
  { name:"premleague", domain:"premierleague.com", q1:"latest Premier League match results and scores",      q2:"Premier League standings table and upcoming fixtures" },
  { name:"uefa",       domain:"uefa.com",          q1:"latest international match results nations league",   q2:"upcoming international fixtures and tournaments" },
  { name:"oddsportal", domain:"oddsportal.com",     q1:"latest football match betting odds",                  q2:"football match winner predictions and odds comparison" },
  { name:"flashscore", domain:"flashscore.com",    q1:"finished football match results scores",               q2:"football league table standings" },
];

async function testDomain(d: DomainTest, deployer: ethers.Signer): Promise<{success:number, totalChars:number, results:string[]}> {
  const F = await ethers.getContractFactory("TestDomainExplorer");
  const c = await F.deploy({gasLimit:60_000_000n}); await c.waitForDeployment();
  const addr = await c.getAddress();
  const dep = await(c as any).dep();

  // Fund (2 calls)
  await (await deployer.sendTransaction({to:addr,value:dep*2n+ethers.parseEther("0.1"),gasLimit:100_000n})).wait();

  // Kirim 2 query
  const tx = await(c as any).testDomain(d.domain, d.q1, d.q2, 1, {gasLimit:120_000_000n});
  await tx.wait();

  const t0=Date.now(); let done=0;
  while(done<2&&Date.now()-t0<MAX_SRC){await sleep(POLL);
    done=0; const n=Number(await(c as any).reqCount());
    for(let i=0;i<n&&i<2;i++) if(await(c as any).received(await(c as any).reqIds(i))) done++;
  }

  let success=0, totalChars=0;
  const results: string[] = [];
  const n=Number(await(c as any).reqCount());
  for(let i=0;i<n&&i<2;i++){
    const rid=await(c as any).reqIds(i), lbl=await(c as any).label(rid);
    const got=await(c as any).received(rid), st=got?Number(await(c as any).statusOf(rid)):-1;
    const res=got?String(await(c as any).result(rid)):"";
    if(st===2&&res.length>0){success++; totalChars+=res.length; results.push(`${lbl}: ${res.slice(0,300)}`);}
  }
  return {success, totalChars, results};
}

async function main(){const[d]=await ethers.getSigners();
  console.log(`[${ts()}] Domain Explorer — ${DOMAINS.length} domains, 2 queries each`);
  console.log(`[${ts()}] Sequential: 1 domain = 1 contract, wait callbacks, next domain\n`);

  const report: {name:string, success:number, chars:number, samples:string}[] = [];

  for(let i=0; i<DOMAINS.length; i++){
    const dom = DOMAINS[i];
    console.log(`\n[${ts()}] ── ${i+1}/${DOMAINS.length}  ${dom.name} (${dom.domain}) ──`);
    try {
      const r = await testDomain(dom, d);
      console.log(`[${ts()}]    ${r.success}/2 success, ${r.totalChars} chars`);
      if(r.results.length>0) r.results.forEach(x=>console.log(`[${ts()}]    ${x.slice(0,200)}`));
      report.push({name:dom.name, success:r.success, chars:r.totalChars, samples:r.results.join(" | ")});
    } catch(e:any){
      console.log(`[${ts()}]    ERROR: ${e.message?.slice(0,100)||e}`);
      report.push({name:dom.name, success:0, chars:0, samples:`ERROR: ${e.message?.slice(0,80)||e}`});
    }
  }

  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`DOMAIN EXPLORATION REPORT`);
  console.log(`${"=".repeat(70)}`);
  console.log(`domain          | success | chars  | sample`);
  console.log(`----------------|---------|--------|-------`);
  for(const r of report){
    const nm = r.name.padEnd(15);
    const sc = `${r.success}/2`.padEnd(8);
    const ch = String(r.chars).padEnd(7);
    const sm = r.samples.slice(0,100);
    console.log(`${nm} | ${sc} | ${ch} | ${sm}`);
  }

  const working = report.filter(r=>r.success>0);
  console.log(`\n${working.length}/${report.length} domains returned data`);
  console.log(`Working domains: ${working.map(r=>r.name).join(", ")}`);
  if(working.length===0) console.log("None worked. Consider: all these sites may block scrapers or require JS rendering.");
}

main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});