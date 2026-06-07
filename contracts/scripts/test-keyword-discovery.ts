/**
 * test-keyword-discovery.ts
 *
 * Arsitektur zero-URL: keyword query → agent SEARCH + DISCOVER URL → extract → LLM
 *
 * 3 query keyword parallel (agent cari URL sendiri):
 *   A: "[topic] recent match results scores standings"
 *   B: "[topic] head to head record last 5 meetings"
 *   C: "[topic] upcoming fixtures schedule next match"
 *
 * Lalu LLM inference dengan SEMUA hasil discovery.
 */

import { ethers } from "hardhat";

const POLL = 5_000;
const MAX  = 360_000;

function ts() { return new Date().toISOString().slice(11, 19); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const [d] = await ethers.getSigners();
  const TOPIC = "English Premier League Manchester City";

  console.log(`[${ts()}] topic: "${TOPIC}"`);
  console.log(`[${ts()}] model: keyword query → agent cari URL sendiri → extract → LLM`);

  // Deploy
  const F = await ethers.getContractFactory("TestKeywordDiscovery");
  const c = await F.deploy({ gasLimit: 60_000_000n });
  await c.waitForDeployment();
  console.log(`[${ts()}] contract: ${await c.getAddress()}`);
  const dep = await (c as any).deposit();
  console.log(`[${ts()}] deposit/call: ${ethers.formatEther(dep)} STT  (total ~${ethers.formatEther(dep * 4n)})`);

  // Fund
  await (await d.sendTransaction({ to: await c.getAddress(), value: ethers.parseEther("3"), gasLimit: 100_000n })).wait();

  // Layer 1: 3 keyword queries parallel
  console.log(`\n════════════════════════════════════════════════`);
  console.log(`LAYER 1: Keyword Discovery (3 queries parallel)`);
  console.log(`════════════════════════════════════════════════`);
  const tx = await (c as any).gatherAll(TOPIC, { gasLimit: 100_000_000n });
  const rec = await tx.wait();

  // Log event SourceReceived dari tx receipt
  const iface = (c as any).interface;
  for (const L of rec.logs) {
    try {
      const p = iface.parseLog({ topics: [...L.topics], data: L.data });
      if (p && p.name === "SourceReceived") console.log(`  ${p.args[0]} → reqId=${p.args[1]}`);
    } catch {}
  }

  const t0 = Date.now();
  let doneIdx = 0;
  while (doneIdx < 3 && Date.now() - t0 < MAX) {
    await sleep(POLL);
    const c2 = Number(await (c as any).reqCount());
    doneIdx = 0;
    for (let i = 0; i < c2; i++) {
      if (await (c as any).received(await (c as any).reqIds(i))) doneIdx++;
    }
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  ${doneIdx}/3 done`);
  }

  // Cetak semua hasil keyword search
  console.log(`\n─── KEYWORD SEARCH RESULTS ───`);
  const total = Number(await (c as any).reqCount());
  for (let i = 0; i < total; i++) {
    const rid = await (c as any).reqIds(i);
    const lbl = await (c as any).label(rid);
    const got = await (c as any).received(rid);
    if (!got) { console.log(`\n[${lbl}]\n  pending`); continue; }
    const st = Number(await (c as any).statusOf(rid));
    const res = String(await (c as any).result(rid));
    console.log(`\n[${lbl}]  status=${st}${st===2?" ✓":""}${st===3?" ✗":""}`);
    if (res) console.log(`  ${res.slice(0, 600)}${res.length > 600 ? "..." : ""}`);
  }

  // Layer 2: LLM inference
  console.log(`\n════════════════════════════════════════════════`);
  console.log(`LAYER 2: LLM Inference (semua context)`);
  console.log(`════════════════════════════════════════════════`);
  const tx2 = await (c as any).infer({ gasLimit: 100_000_000n });
  await tx2.wait();
  while (!(await (c as any).llmDone()) && Date.now() - t0 < MAX) {
    await sleep(POLL);
    console.log(`[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  wait LLM...`);
  }

  if (await (c as any).llmDone()) {
    console.log(`\n╔══════════════════════════════════════════`);
    console.log(`║ LLM FINAL OUTPUT`);
    console.log(`╠══════════════════════════════════════════`);
    console.log(`║ question: ${await (c as any).llmQuestion()}`);
    console.log(`║ odds    : ${await (c as any).llmOdds()}`);
    console.log(`║ deadline: ${await (c as any).llmDeadlineHours()}h`);
    console.log(`╚══════════════════════════════════════════`);
    const raw = String(await (c as any).llmRaw());
    const hasSkip = raw.toLowerCase().includes("skip");
    if (hasSkip) console.log(`\n  ⚠️  SKIP — data dari keyword search tidak cukup untuk market`);
    else console.log(`\n  ✓ Market valid — keyword-based, zero URL, fully autonomous`);
  }

  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("3") - await ethers.provider.getBalance(await c.getAddress()))} STT`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });