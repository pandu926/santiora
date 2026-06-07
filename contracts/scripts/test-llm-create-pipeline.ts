/**
 * test-llm-create-pipeline.ts
 *
 * Validasi pipeline LLM:
 *   data scraper "West Ham United 3-0 Leeds United"
 *   → PHASE_CREATE: LLM bikin pertanyaan market + odds + deadline
 *   → PHASE_QUALITY: LLM quality gate cek uncertainty + resolvability
 *
 * Meniru persis flow _askCreate → _askQuality di V3 Creator.
 */

import { ethers } from "hardhat";

const POLL_MS = 5_000;
const MAX_WAIT = 240_000;

function ts() { return new Date().toISOString().slice(11, 19); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [deployer] = await ethers.getSigners();
  const SCRAPED = "West Ham United 3-0 Leeds United";
  const CATEGORY = "sports";

  console.log(`[${ts()}] scrape data: "${SCRAPED}"`);
  console.log(`[${ts()}] category   : ${CATEGORY}`);

  // 1. Deploy
  console.log(`\n[${ts()}] Deploy TestLLMCreate...`);
  const F = await ethers.getContractFactory("TestLLMCreate");
  const c = await F.deploy({ gasLimit: 50_000_000n });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`[${ts()}]    deployed: ${addr}`);
  console.log(`[${ts()}]    deposit/call: ${ethers.formatEther(await (c as any).getDeposit())} STT`);

  // 2. Fund
  console.log(`\n[${ts()}] Fund 1 STT (cukup buat 2 LLM call @ 0.33)...`);
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n })).wait();

  // 3. Mulai PHASE_CREATE
  console.log(`\n[${ts()}] PHASE_CREATE — kirim data scraper ke LLM...`);
  const tx1 = await (c as any).start(CATEGORY, SCRAPED, { gasLimit: 60_000_000n });
  const receipt1 = await tx1.wait();

  // Baca event PhaseSent dari logs
  const iface = (c as any).interface;
  for (const L of receipt1.logs) {
    try {
      const p = iface.parseLog({ topics: [...L.topics], data: L.data });
      if (p && p.name === "PhaseSent") {
        console.log(`[${ts()}]    reqId: ${p.args[1]}  label: ${p.args[0]}`);
        console.log(`[${ts()}]    system prompt: Create YES/NO market from data...`);
        console.log(`[${ts()}]    user  message: "Category: sports. Current data: West Ham 3-0 Leeds"`);
      }
    } catch {}
  }

  // 4. Poll PHASE_CREATE callback
  const t0 = Date.now();
  let createDone = false;
  let createReqId: bigint | null = null;

  while (!createDone && Date.now() - t0 < MAX_WAIT) {
    await sleep(POLL_MS);
    const count = Number(await (c as any).reqCount());
    if (count === 0) continue;
    const rid = await (c as any).reqIds(0);
    createReqId = rid;
    const phase = Number(await (c as any).phaseOf(rid));
    if (phase === 1) {
      // Cek via events (PhaseDone) — atau langsung via createResult.received
      if (await (c as any).createResult()) {
        const cr = await (c as any).createResult();
        if (cr.received) {
          createDone = true;
          console.log(`\n[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  PHASE_CREATE DONE!`);
          console.log(`           status  : ${cr.status} (${Number(cr.status)===2?"SUCCESS":"FAILED"})`);
          console.log(`           question: "${cr.question}"`);
          console.log(`           odds    : ${cr.odds}`);
          console.log(`           deadline: ${cr.deadlineHours}h`);
          if (String(cr.response)) {
            const r = String(cr.response);
            if (r.toLowerCase().includes("skip")) console.log(`           !! SKIP ditemukan di response`);
          }
        }
      }
    }
    const elapsed = Math.round((Date.now()-t0)/1000);
    if (!createDone && elapsed % 10 === 0) console.log(`[${ts()}] +${elapsed}s  waiting...`);
  }

  if (!createDone) {
    console.log(`\n[${ts()}] TIMEOUT — PHASE_CREATE tak selesai`);
    return;
  }

  // 5. PHASE_QUALITY
  console.log(`\n[${ts()}] PHASE_QUALITY — kirim hasil CREATE ke LLM untuk quality check...`);
  const tx2 = await (c as any).qualityGate({ gasLimit: 60_000_000n });
  await tx2.wait();

  let qualityDone = false;
  while (!qualityDone && Date.now() - t0 < MAX_WAIT) {
    await sleep(POLL_MS);
    const count = Number(await (c as any).reqCount());
    if (count < 2) continue;
    const rid = await (c as any).reqIds(1);
    const phase = Number(await (c as any).phaseOf(rid));
    if (phase === 2) {
      const r = await (c as any).results(rid);
      if (r.received) {
        qualityDone = true;
        console.log(`\n[${ts()}] +${Math.round((Date.now()-t0)/1000)}s  PHASE_QUALITY DONE!`);
        console.log(`           status    : ${r.status} (${Number(r.status)===2?"SUCCESS":"FAILED"})`);
        console.log(`           approved  : ${r.qualityApproved}`);
        console.log(`           reason    : "${r.qualityReason}"`);
        console.log(`           improved  : "${r.improvedQuestion}"`);
      }
    }
    const elapsed = Math.round((Date.now()-t0)/1000);
    if (!qualityDone && elapsed % 10 === 0) console.log(`[${ts()}] +${elapsed}s  waiting quality...`);
  }

  // 6. Analisis final
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ANALISIS LLM PIPELINE`);
  console.log(`${"=".repeat(60)}`);

  const cr = await (c as any).createResult();
  console.log(`\nInput scraper : "${SCRAPED}"`);
  console.log(`LLM Create    : question="${cr.question}"  odds=${cr.odds}  deadline=${cr.deadlineHours}h`);

  if (qualityDone) {
    const rid = await (c as any).reqIds(1);
    const qr = await (c as any).results(rid);
    console.log(`Quality Gate  : approved=${qr.qualityApproved}  reason="${qr.qualityReason}"`);
    if (qr.qualityApproved && String(qr.improvedQuestion).length > 0) {
      console.log(`Improved Q    : "${qr.improvedQuestion}"`);
    }
    console.log(`\nVerdict: ${qr.qualityApproved ? "✓ APPROVED — market layak dibuat" : "✗ REJECTED"}`);
    if (!qr.qualityApproved) {
      console.log(`  Alasan: ${qr.qualityReason}`);
      console.log(`  Implikasi: V3 Creator akan rejectCreated → PipelineFailed`);
    }
  }

  const balAfter = await ethers.provider.getBalance(addr);
  console.log(`\nspent: ${ethers.formatEther(ethers.parseEther("1") - balAfter)} STT (harusnya ~${qualityDone ? "0.66" : "0.33"})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });