/**
 * test-massive-gather.ts — 8 parallel keyword queries → LLM with ALL context */

import { ethers } from "hardhat";

const POLL = 5_000;
const MAX  = 420_000;
function ts() { return new Date().toISOString().slice(11, 19); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [d] = await ethers.getSigners();
  console.log(`[${ts()}] 8 parallel keyword queries → LLM inference`);

  const F = await ethers.getContractFactory("TestMassiveGather");
  const c = await F.deploy({ gasLimit: 100_000_000n });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  const dep = await (c as any).dep();
  // 8 scraper + 1 LLM
  const totalCost = dep * 9n;
  console.log(`[${ts()}] contract: ${addr}  |  deposit: ${ethers.formatEther(dep)} STT  |  total ~${ethers.formatEther(totalCost)} STT`);

  await (await d.sendTransaction({ to: addr, value: ethers.parseEther("6"), gasLimit: 100_000n })).wait();

  // ═══ Layer 1: 8 parallel queries ═══
  console.log(`\n=== LAYER 1: 8 keyword discovery queries (parallel) ===`);
  const tx = await (c as any).gatherAll({ gasLimit: 200_000_000n });
  await tx.wait();
  console.log(`[${ts()}] 8 queries sent`);

  const t0 = Date.now();
  let done = 0;
  while (done < 8 && Date.now() - t0 < MAX) {
    await sleep(POLL);
    done = 0;
    const n = Number(await (c as any).reqCount());
    for (let i=0; i<n; i++) {
      if (await (c as any).received(await (c as any).reqIds(i))) done++;
    }
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  ${done}/8`);
  }

  // Print hasil per source
  console.log(`\n─── GATHERED DATA ───`);
  let totalChars = 0;
  let successCount = 0;
  const n = Number(await (c as any).reqCount());
  for (let i=0; i<n; i++) {
    const rid = await (c as any).reqIds(i);
    const lbl = await (c as any).label(rid);
    const got = await (c as any).received(rid);
    if (!got) {
      console.log(`\n[${lbl}] ⏱ pending`);
      continue;
    }
    const st = Number(await (c as any).statusOf(rid));
    const res = String(await (c as any).result(rid));
    console.log(`\n[${lbl}] ${st===2?'✓ SUCCESS':'✗ FAILED'}  (${res.length} chars)`);
    if (res) {
      console.log(`  ${res.slice(0, 400)}${res.length>400?'...':''}`);
      if (st===2) { totalChars += res.length; successCount++; }
    }
  }

  if (successCount === 0) {
    console.log(`\n✗ No sources succeeded. Abort.`);
    return;
  }

  console.log(`\n   Total: ${successCount}/8 sources succeeded, ${totalChars} chars of context`);

  // ═══ Layer 2: LLM Inference ═══
  console.log(`\n=== LAYER 2: LLM Inference (${totalChars} chars of context) ===`);
  const tx2 = await (c as any).infer({ gasLimit: 120_000_000n });
  await tx2.wait();

  while (!(await (c as any).llmDone()) && Date.now()-t0 < MAX) {
    await sleep(POLL);
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  waiting LLM...`);
  }

  if (await (c as any).llmDone()) {
    const q = String(await (c as any).llmQuestion());
    const o = Number(await (c as any).llmOdds());
    const dl = Number(await (c as any).llmDeadlineHours());
    console.log(`\n╔══════════════════════════════════════════`);
    console.log(`║ LLM FINAL OUTPUT`);
    console.log(`╠══════════════════════════════════════════`);
    console.log(`║ question : ${q}`);
    console.log(`║ odds     : ${o}`);
    console.log(`║ deadline : ${dl}h`);
    console.log(`╚══════════════════════════════════════════`);
    console.log(`\n  context: ${totalChars} chars from ${successCount} sources`);
    if (q.toLowerCase().includes('skip')) console.log(`  ⚠️  data insufficient → LLM chose SKIP`);
    else console.log(`  ✓ LLM created market from rich multi-source context`);
  }

  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("6") - await ethers.provider.getBalance(addr))} STT`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });