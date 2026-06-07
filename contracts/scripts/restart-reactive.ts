import { ethers } from "hardhat";

const REACTIVE = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";

async function main() {
  const [signer] = await ethers.getSigners();
  const reactive = new ethers.Contract(REACTIVE, [
    "function stopCreateLoop() external",
    "function stopResolveLoop() external",
    "function startCreateLoop() external",
    "function startResolveLoop() external",
    "function createSubscriptionId() view returns (uint256)",
    "function resolveSubscriptionId() view returns (uint256)",
    "function lastCreateBlock() view returns (uint256)",
    "function createIntervalBlocks() view returns (uint64)",
  ], signer);

  // Try stop, ignore if reverts (expired subscriptions)
  console.log("Stopping loops (ignoring reverts on expired subs)...");
  try { await (await reactive.stopCreateLoop({ gasLimit: 5_000_000n })).wait(); console.log("  create stopped"); } catch { console.log("  create stop reverted (expired?)"); }
  try { await (await reactive.stopResolveLoop({ gasLimit: 5_000_000n })).wait(); console.log("  resolve stopped"); } catch { console.log("  resolve stop reverted (expired?)"); }

  // Check sub IDs - if still non-zero, can't start (require check)
  let createSub = await reactive.createSubscriptionId();
  let resolveSub = await reactive.resolveSubscriptionId();
  console.log(`\nSub IDs after stop: create=${createSub}, resolve=${resolveSub}`);

  if (createSub === 0n) {
    console.log("Starting create loop...");
    await (await reactive.startCreateLoop({ gasLimit: 5_000_000n })).wait();
    console.log("  started");
  } else {
    console.log("Create sub still non-zero, cannot restart via startCreateLoop");
  }

  if (resolveSub === 0n) {
    console.log("Starting resolve loop...");
    await (await reactive.startResolveLoop({ gasLimit: 5_000_000n })).wait();
    console.log("  started");
  } else {
    console.log("Resolve sub still non-zero, cannot restart via startResolveLoop");
  }

  const currentBlock = await ethers.provider.getBlockNumber();
  const interval = Number(await reactive.createIntervalBlocks());
  const lastCreate = Number(await reactive.lastCreateBlock());
  console.log(`\nCurrent block: ${currentBlock}`);
  console.log(`Last create block: ${lastCreate}`);
  console.log(`Interval: ${interval} blocks (~${Math.round(interval * 0.4)}s)`);
  console.log(`Create sub: ${await reactive.createSubscriptionId()}`);
  console.log(`Resolve sub: ${await reactive.resolveSubscriptionId()}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
