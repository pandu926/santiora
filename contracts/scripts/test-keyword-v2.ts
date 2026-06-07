/**
 * test-keyword-v2.ts — Coba search di domain news (bukan livescore/espn) */
import { ethers } from "hardhat";

const POLL = 5_000;
const MAX  = 300_000;
function ts() { return new Date().toISOString().slice(11, 19); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [d] = await ethers.getSigners();

  console.log(`[${ts()}] v2: domain-based search, 3 news sites`);
  const F = await ethers.getContractFactory("TestKeywordV2");
  const c = await F.deploy({ gasLimit: 60_000_000n });
  await c.waitForDeployment();
  console.log(`[${ts()}] deploy: ${await c.getAddress()}`);

  await (await d.sendTransaction({ to: await c.getAddress(), value: ethers.parseEther("2"), gasLimit: 100_000n })).wait();

  const tx = await (c as any).gatherAll({ gasLimit: 120_000_000n });
  console.log(`[${ts()}] 3 queries sent: ${tx.hash}`);

  const t0 = Date.now();
  while (Number(await (c as any).reqCount()) < 3) await sleep(1_000);
  let done = 0;
  while (done < 3 && Date.now() - t0 < MAX) {
    await sleep(POLL);
    done = 0; const n = Number(await (c as any).reqCount());
    for (let i=0; i<n; i++) if (await (c as any).received(await (c as any).reqIds(i))) done++;
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  ${done}/3`);
  }

  const total = Number(await (c as any).reqCount());
  for (let i=0; i<total; i++) {
    const rid = await (c as any).reqIds(i);
    const lbl = await (c as any).label(rid);
    const got = await (c as any).received(rid);
    const st = got ? Number(await (c as any).statusOf(rid)) : -1;
    const res = got ? String(await (c as any).result(rid)) : "";
    console.log(`\n[${lbl}] status=${st}${st===2?" ✓":st===3?" ✗":""}`);
    if (res) console.log(`  ${res.slice(0,700)}`);
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });