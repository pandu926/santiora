import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT`);

  console.log("\nDeploying TestYieldResume...");
  const factory = await ethers.getContractFactory("TestYieldResume");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("3"), gasLimit: 100_000n })).wait();
  console.log(`Funded 3 STT\n`);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Initial call - LLM should yield tool_calls
  // ═══════════════════════════════════════════════════════════
  console.log("=== STEP 1: inferToolsChat with fetchPrice tool ===");
  await (await contract.step1_InitialCall({ gasLimit: 200_000_000n })).wait();
  console.log("Step 1 submitted. Waiting for callback...\n");

  await pollUntilPhase(contract, 2, 120_000); // Phase.ExecutingTool = 2
  let state = await contract.getState();
  console.log(`  Phase: ${phaseStr(Number(state.phase))}`);
  console.log(`  Step1 Status: ${statusStr(Number(state.s1Status))}`);
  console.log(`  FinishReason: "${state.yieldFR}"`);
  console.log(`  Pending tools: ${Number(state.pendingCount)}`);

  if (Number(state.phase) < 2) {
    console.log(`\n  FAILED at step 1. Error: ${state.err}`);
    return;
  }

  // Show pending calldata
  const pending = await contract.pendingToolCalls(0);
  console.log(`  Calldata: ${pending.slice(0, 100)}...`);
  const toolId = await contract.pendingToolCallIds(0);
  console.log(`  Tool call ID: "${toolId}"\n`);

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Execute tool (fetch BTC price from CoinGecko)
  // ═══════════════════════════════════════════════════════════
  console.log("=== STEP 2: Execute tool (JSON API fetch BTC price) ===");
  await (await contract.step2_ExecuteTool({ gasLimit: 200_000_000n })).wait();
  console.log("Step 2 submitted. Waiting for JSON agent callback...\n");

  await pollUntilPhase(contract, 3, 120_000); // Phase.WaitingResume = 3
  state = await contract.getState();
  console.log(`  Phase: ${phaseStr(Number(state.phase))}`);
  console.log(`  Step2 Status: ${statusStr(Number(state.s2Status))}`);
  console.log(`  Tool result (BTC price): "${state.toolRes}"`);

  if (Number(state.phase) < 3) {
    console.log(`\n  FAILED at step 2. Error: ${state.err}`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Resume with tool result
  // ═══════════════════════════════════════════════════════════
  console.log("\n=== STEP 3: Resume inferToolsChat with tool result ===");
  await (await contract.step3_Resume({ gasLimit: 200_000_000n })).wait();
  console.log("Step 3 submitted. Waiting for final LLM response...\n");

  await pollUntilPhase(contract, 4, 120_000); // Phase.Done = 4
  state = await contract.getState();
  console.log(`  Phase: ${phaseStr(Number(state.phase))}`);
  console.log(`  Step3 Status: ${statusStr(Number(state.s3Status))}`);
  console.log(`  Final FinishReason: "${state.finalFR}"`);
  console.log(`  Final Response (${state.finalResp.length} chars):`);
  console.log(`  ${state.finalResp.slice(0, 1000)}`);

  if (state.err) {
    console.log(`\n  Error: ${state.err}`);
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "=".repeat(60));
  console.log("YIELD & RESUME PROOF - SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Step 1 (inferToolsChat): ${statusStr(Number(state.s1Status))} - finishReason="${state.yieldFR}", ${Number(state.pendingCount)} tools`);
  console.log(`  Step 2 (execute tool):   ${statusStr(Number(state.s2Status))} - BTC price="${state.toolRes}"`);
  console.log(`  Step 3 (resume):         ${statusStr(Number(state.s3Status))} - finishReason="${state.finalFR}"`);
  console.log(`  Final market response:   ${state.finalResp.length > 0 ? "YES" : "NO"} (${state.finalResp.length} chars)`);
  console.log(`  Full loop working:       ${state.finalFR === "stop" && state.finalResp.length > 0 ? "YES" : "NO"}`);
}

function phaseStr(p: number): string {
  const phases = ["Initial", "WaitingToolCalls", "ExecutingTool", "WaitingResume", "Done"];
  return phases[p] || `unknown(${p})`;
}

function statusStr(s: number): string {
  const statuses: Record<number, string> = { 0: "NONE", 1: "PENDING", 2: "SUCCESS", 3: "FAILED", 4: "TIMEOUT" };
  return statuses[s] || `code=${s}`;
}

async function pollUntilPhase(contract: any, targetPhase: number, maxMs: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const state = await contract.getState();
    const phase = Number(state.phase);
    if (phase >= targetPhase) return;
    // Also break if Done (4) with error
    if (phase === 4) return;
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 8_000));
  }
  console.log("  (timeout waiting for phase)");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
