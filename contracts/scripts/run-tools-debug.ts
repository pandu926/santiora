import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT\n`);

  console.log("Compiling & deploying TestToolsDebug...");
  const factory = await ethers.getContractFactory("TestToolsDebug");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("5"), gasLimit: 100_000n })).wait();
  console.log(`Funded 5 STT\n`);

  const deposit = await contract.getDeposit();
  console.log(`Deposit per request: ${ethers.formatEther(deposit)} STT`);
  console.log(`Contract balance: ${ethers.formatEther(await signer.provider.getBalance(addr))} STT\n`);

  const tests = [
    { name: "test1_MinimalTool", fn: () => contract.test1_MinimalTool({ gasLimit: 200_000_000n }) },
    { name: "test2_NoAgentId", fn: () => contract.test2_NoAgentId({ gasLimit: 200_000_000n }) },
    { name: "test3_AgentIdString", fn: () => contract.test3_AgentIdString({ gasLimit: 200_000_000n }) },
    { name: "test4_ToolsIterZeroSimple", fn: () => contract.test4_ToolsIterZeroSimple({ gasLimit: 200_000_000n }) },
    { name: "test5_OpenAIFormat", fn: () => contract.test5_OpenAIFormat({ gasLimit: 200_000_000n }) },
    { name: "test6_HigherDeposit", fn: () => contract.test6_HigherDeposit({ gasLimit: 200_000_000n }) },
    { name: "test7_Baseline", fn: () => contract.test7_Baseline({ gasLimit: 200_000_000n }) },
  ];

  for (const t of tests) {
    try {
      const tx = await t.fn();
      const receipt = await tx.wait();
      const gasUsed = receipt?.gasUsed || 0n;
      console.log(`[OK] ${t.name} - gas: ${gasUsed.toLocaleString()}`);
    } catch (e: any) {
      console.log(`[FAIL] ${t.name} - ${e.message?.slice(0, 120)}`);
    }
  }

  console.log(`\n7 requests submitted. Polling 240s for callbacks...\n`);

  const MAX_MS = 240_000;
  const POLL_MS = 12_000;
  const t0 = Date.now();
  const printed = new Set<number>();

  while (Date.now() - t0 < MAX_MS) {
    const count = Number(await contract.resultCount());
    let received = 0;

    for (let i = 0; i < count; i++) {
      const r = await contract.getResult(i);
      if (r.received) {
        received++;
        if (!printed.has(i)) {
          printed.add(i);
          const statusStr = r.status === 2 ? "SUCCESS" : r.status === 3 ? "FAILED" : `code=${r.status}`;
          console.log(`\n${"━".repeat(60)}`);
          console.log(`[${i}] ${r.label}`);
          console.log(`  Status: ${statusStr}`);
          console.log(`  RawLen: ${Number(r.rawLen)} bytes`);
          console.log(`  FinishReason: "${r.finishReason}"`);
          console.log(`  Response (${r.response.length} chars): ${r.response.slice(0, 500)}`);
          console.log(`  Pending tool calls: ${Number(r.pendingCount)}`);

          if (Number(r.pendingCount) > 0) {
            const pending = await contract.getPendingCalls(i);
            for (let j = 0; j < pending.ids.length; j++) {
              console.log(`    tool[${j}] id=${pending.ids[j]}`);
              try {
                const decoded = ethers.toUtf8String(pending.calls[j]);
                console.log(`    tool[${j}] data=${decoded.slice(0, 300)}`);
              } catch {
                console.log(`    tool[${j}] raw=${pending.calls[j].slice(0, 100)}`);
              }
            }
          }
        }
      }
    }

    if (received >= count && count > 0) {
      console.log(`\nAll ${received}/${count} responses received!`);
      break;
    }

    const elapsed = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`  [${elapsed}s] ${received}/${count} received\r`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Summary
  console.log("\n\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  const count = Number(await contract.resultCount());
  for (let i = 0; i < count; i++) {
    const r = await contract.getResult(i);
    const statusStr = r.status === 2 ? "SUCCESS" : r.status === 3 ? "FAILED" : r.status === 0 ? "NO_RESPONSE" : `code=${r.status}`;
    const hasTools = Number(r.pendingCount) > 0 ? ` [${r.pendingCount} pending tools]` : "";
    console.log(`  ${r.label.padEnd(25)} ${statusStr.padEnd(10)} raw=${Number(r.rawLen)}B resp=${r.response.length}ch${hasTools}`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
