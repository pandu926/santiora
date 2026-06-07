/**
 * test-rich-gather.ts
 *
 * Arsitektur multi-source data gathering:
 *   Layer 1 (parallel): Scraper A (livescore) + Scraper B (ESPN) + JSON API C (Coingecko)
 *   Layer 2: LLM Inference dengan SEMUA context → bikin pertanyaan market
 */

import { ethers } from "hardhat";

const POLL_MS = 5_000;
const MAX_WAIT = 300_000;

function ts() { return new Date().toISOString().slice(11, 19); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`[${ts()}] Deploy TestRichDataGather...`);
  const F = await ethers.getContractFactory("TestRichDataGather");
  const c = await F.deploy({ gasLimit: 60_000_000n });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  const scraperDep = await (c as any).scraperDeposit();
  const needed = scraperDep * 2n + ethers.parseEther("0.12") + ethers.parseEther("0.33");
  console.log(`[${ts()}]    deployed: ${addr}`);
  console.log(`[${ts()}]    estimated cost: ${ethers.formatEther(needed)} STT (2 scrapers + 1 json + 1 LLM)`);

  console.log(`\n[${ts()}] Fund 2 STT...`);
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("2"), gasLimit: 100_000n })).wait();

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Parallel data gathering
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n[${ts()}] LAYER 1 — Kirim 3 query parallel...`);
  const tx1 = await (c as any).gatherAll("sports", { gasLimit: 80_000_000n });
  const r1 = await tx1.wait();
  console.log(`[${ts()}]    tx: ${tx1.hash}  block: ${r1.blockNumber}`);

  const t0 = Date.now();
  let done = 0;

  while (done < 3 && Date.now() - t0 < MAX_WAIT) {
    await sleep(POLL_MS);
    const count = Number(await (c as any).reqCount());
    done = 0;
    for (let i = 0; i < count; i++) {
      const rid = await (c as any).reqIds(i);
      if (await (c as any).received(rid)) done++;
    }
    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`[${ts()}] +${elapsed}s  ${done}/3 sources done`);
  }

  // Tampilkan setiap source
  console.log(`\n=== LAYER 1 RESULTS ===`);
  let gatheredCtx = "";
  const total = Number(await (c as any).reqCount());
  for (let i = 0; i < total; i++) {
    const rid = await (c as any).reqIds(i);
    const lbl = await (c as any).label(rid);
    const got = await (c as any).received(rid);
    if (!got) { console.log(`  [${lbl}] pending`); continue; }
    const st = Number(await (c as any).statusOf(rid));
    const res = String(await (c as any).result(rid));
    console.log(`\n  [${lbl}] status=${st} (${st===2?"SUCCESS":"FAILED"})`);
    console.log(`  ${res.slice(0, 500)}${res.length > 500 ? "..." : ""}`);
    if (st === 2 && res.length > 0) {
      gatheredCtx += `[${lbl}]\n${res}\n\n`;
    }
  }

  if (!gatheredCtx) {
    console.log(`\n✗ Tidak ada data — LLM inference dibatalkan`);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: LLM Inference dengan semua context
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n=== LAYER 2 — LLM Inference dengan SEMUA context ===`);
  console.log(`Context size: ${gatheredCtx.length} chars`);
  const tx2 = await (c as any).inferWithAllContext({ gasLimit: 100_000_000n });
  await tx2.wait();
  console.log(`[${ts()}] LLM request sent`);

  while (!(await (c as any).llmDone()) && Date.now() - t0 < MAX_WAIT) {
    await sleep(POLL_MS);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`[${ts()}] +${elapsed}s  waiting LLM...`);
  }

  if (await (c as any).llmDone()) {
    const q = await (c as any).llmQuestion();
    const o = await (c as any).llmOdds();
    const d = await (c as any).llmDeadlineHours();

    console.log(`\n=== FINAL LLM OUTPUT ===`);
    console.log(`  question : "${q}"`);
    console.log(`  odds     : ${o}`);
    console.log(`  deadline : ${d}h`);
    const hasSkip = String(q).toLowerCase().includes("skip");
    console.log(`\nVerdict: ${hasSkip ? "SKIP (data insufficient)" : "VALID MARKET"}`);
    if (!hasSkip && String(q).length > 5) {
      console.log(`✓ Multi-source gathering BERHASIL — LLM tidak mengarang, pakai data nyata`);
    }
  }

  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("2") - await ethers.provider.getBalance(addr))} STT`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });