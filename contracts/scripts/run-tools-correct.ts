import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT`);

  const factory = await ethers.getContractFactory("TestToolsCorrectFormat");
  console.log("\nDeploying...");
  const contract = await factory.deploy({ gasLimit: 200_000_000n });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`Deployed: ${addr}`);

  await (await signer.sendTransaction({ to: addr, value: ethers.parseEther("3"), gasLimit: 100_000n })).wait();
  console.log(`Funded 3 STT`);

  const deposit = await contract.getDeposit();
  console.log(`Deposit/req: ${ethers.formatEther(deposit)} STT\n`);

  const tests = [
    { name: "test1_CorrectFormat", fn: () => contract.test1_CorrectFormat({ gasLimit: 200_000_000n }) },
    { name: "test2_MultipleTools", fn: () => contract.test2_MultipleTools({ gasLimit: 200_000_000n }) },
    { name: "test3_ComplexSignature", fn: () => contract.test3_ComplexSignature({ gasLimit: 200_000_000n }) },
    { name: "test4_IterZero", fn: () => contract.test4_IterZero({ gasLimit: 200_000_000n }) },
    { name: "test5_Baseline", fn: () => contract.test5_Baseline({ gasLimit: 200_000_000n }) },
  ];

  for (const t of tests) {
    try {
      const tx = await t.fn();
      const receipt = await tx.wait();
      console.log(`[OK] ${t.name} - gas: ${receipt?.gasUsed?.toLocaleString()}`);
    } catch (e: any) {
      console.log(`[FAIL TX] ${t.name} - ${e.message?.slice(0, 150)}`);
    }
  }

  console.log(`\n5 requests submitted. Polling 240s...\n`);

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
          console.log(`\n${"=".repeat(60)}`);
          console.log(`[${i}] ${r.label}`);
          console.log(`  Status: ${statusStr}`);
          console.log(`  FinishReason: "${r.finishReason}"`);
          console.log(`  RawLen: ${Number(r.rawLen)} bytes`);
          console.log(`  Response (${r.response.length} chars): ${r.response.slice(0, 600)}`);
          console.log(`  Pending tool calls: ${Number(r.pendingCount)}`);

          if (Number(r.pendingCount) > 0) {
            const pending = await contract.getPendingCalls(i);
            for (let j = 0; j < pending.ids.length; j++) {
              console.log(`    tool[${j}] id="${pending.ids[j]}"`);
              try {
                const calldata = pending.calls[j];
                const selector = calldata.slice(0, 10);
                console.log(`    tool[${j}] selector=${selector}`);
                console.log(`    tool[${j}] calldata(${calldata.length} bytes)=${calldata.slice(0, 200)}`);
              } catch {
                console.log(`    tool[${j}] raw=${pending.calls[j].slice(0, 100)}`);
              }
            }
          }
        }
      }
    }

    if (received >= count && count > 0) {
      console.log(`\n\nAll ${received}/${count} responses received!`);
      break;
    }

    const elapsed = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`  [${elapsed}s] ${received}/${count} received\r`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY - CORRECT FORMAT TEST");
  console.log("=".repeat(60));
  const count = Number(await contract.resultCount());
  for (let i = 0; i < count; i++) {
    const r = await contract.getResult(i);
    const statusStr = r.status === 2 ? "SUCCESS" : r.status === 3 ? "FAILED" : r.status === 0 ? "NONE" : `code=${r.status}`;
    const tools = Number(r.pendingCount) > 0 ? `[${r.pendingCount} tools pending]` : "";
    console.log(`  ${r.label.padEnd(25)} ${statusStr.padEnd(10)} finish="${r.finishReason}" resp=${r.response.length}ch ${tools}`);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
