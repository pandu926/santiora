# Troubleshooting

Common issues, their root causes, and fixes when working with Santiora on Somnia Testnet.

## Contract Deployment

### "Status: reverted" on deploy

**Cause:** Gas limit too low. Santiora contracts are large and Somnia's gas estimation differs from Ethereum.

**Fix:** Let viem estimate gas automatically, or use a high explicit value:

```javascript
// Let viem estimate
const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [...],
  // No gas field — viem estimates
});

// Or estimate manually with buffer
const estimate = await client.estimateGas({ ... });
const hash = await wallet.deployContract({
  ...
  gas: estimate * 130n / 100n, // 30% buffer
});
```

ReactiveV2 typically needs ~31M gas for deployment.

### "InsufficientBalance" when creating subscription

**Cause:** Contract balance below 32 STT (Somnia's minimum for subscription owners).

**Fix:** Fund the contract with at least 35 STT:

```javascript
await wallet.sendTransaction({
  to: contractAddress,
  value: parseEther("40"),
});
```

## ReactiveV2 Issues

### Loops not firing

**Symptoms:** `createFires` and `resolveFires` stay at 0 after expected time.

**Diagnosis:**

```javascript
const createSubId = await readContract({ functionName: "createSubscriptionId" });
const resolveSubId = await readContract({ functionName: "resolveSubscriptionId" });
const balance = await getBalance({ address: REACTIVE_V2 });

console.log("Create sub:", createSubId); // 0 = dead
console.log("Resolve sub:", resolveSubId); // 0 = dead
console.log("Balance:", formatEther(balance)); // < 32 = can't subscribe
```

**Common causes:**
1. Subscription IDs are 0 → loops never started or died. Call `startCreateLoop()` / `startResolveLoop()`.
2. Balance below 32 STT → re-schedule failed. Top up and restart.
3. Callback reverted → subscription consumed but not re-scheduled. Check FinalV2 state and restart.

### Loop fired but marketsCreated = 0

**Cause:** `createFires` increments but `marketsCreated` stays 0.

**Diagnosis:**
1. Check `FinalV2.canCreateMarket()` — may return false (daily limit, cooldown)
2. Check `FinalV2.reactiveContract()` — must point to current ReactiveV2
3. Check FinalV2 balance — needs STT for agent calls

```javascript
const [allowed, reason] = await readContract({
  address: FINAL_V2,
  functionName: "canCreateMarket",
});
console.log("Can create:", allowed, reason);

const reactive = await readContract({
  address: FINAL_V2,
  functionName: "reactiveContract",
});
console.log("Authorized reactive:", reactive);
// Must match your ReactiveV2 address
```

**Fix:** Update authorization:
```javascript
await writeContract({
  address: FINAL_V2,
  functionName: "setReactiveContract",
  args: [REACTIVE_V2_ADDRESS],
});
```

### Gas cost higher than expected

**Cause:** `gasLimitCreate` set too high. You pay for the full gas limit even if the callback uses less.

**Fix:** Check actual gas usage in explorer, then set appropriate limits:

```javascript
await writeContract({
  address: REACTIVE_V2,
  functionName: "setGasLimits",
  args: [
    20_000_000n, // create (needs high for inferToolsChat chain)
    10_000_000n, // resolve (lower — just scans markets)
  ],
});
```

## Betting Issues

### SUSD approve succeeds but bet reverts

**Cause:** Approve used insufficient gas. On Somnia, `approve` needs 5M gas. With less, the transaction "succeeds" (no revert) but the allowance isn't actually set.

**Diagnosis:**
```javascript
const allowance = await readContract({
  address: SUSD_ADDRESS,
  functionName: "allowance",
  args: [userAddress, marketAddress],
});
console.log("Allowance:", allowance); // 0 = approve didn't work
```

**Fix:** Always use 5M gas for approve:
```javascript
await writeContract({
  functionName: "approve",
  args: [marketAddress, amount],
  gas: 5_000_000n,
});
```

### Error 0xfb8f41b2

**Cause:** This is the `TransferFrom` error — SUSD transfer failed because allowance is 0.

**Fix:** Same as above. Ensure approve uses 5M gas.

### "market not active" revert

**Cause:** Market status is not 1 (Active). Could be:
- Status 0: Still waiting for AI to generate (Created state)
- Status 3+: Already resolved

**Fix:** Check market status before allowing bet in UI:
```javascript
const info = await readContract({
  address: marketAddress,
  functionName: "getMarketInfo",
});
const status = info[2]; // 1 = Active
```

## Frontend Issues

### Markets page empty

**Cause:** `fetchAllMarkets()` failing silently.

**Diagnosis:** Check browser console for errors. Common causes:
1. RPC rate limiting — reduce batch size
2. MarketRegistry address wrong — check `src/lib/onchain.ts`
3. ABI mismatch — registry returns different tuple than expected

**Fix:** Verify registry is accessible:
```javascript
const count = await publicClient.readContract({
  address: MARKET_REGISTRY,
  abi: [{ type: "function", name: "getMarketCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
  functionName: "getMarketCount",
});
console.log("Markets:", count);
```

### Activity feed stuck on "Loading"

**Cause:** `getLogs` failing or returning unexpected format.

**Fix:** The activity hook uses raw topic decoding. If contract events change, update the topic hashes in `useOnchainActivity.ts`.

### BigInt overflow in UI

**Cause:** Trying to render a BigInt directly or passing it to `Number()` when it exceeds safe integer range.

**Fix:** Use `formatUnits` or `formatEther` before displaying:
```typescript
import { formatUnits } from "viem";
const display = formatUnits(bigintValue, 18);
```

### "Chain does not support multicall3"

**Cause:** Using `publicClient.multicall()` — Somnia doesn't deploy Multicall3.

**Fix:** Replace with `Promise.allSettled` batches:
```typescript
// Wrong
const results = await publicClient.multicall({ contracts: [...] });

// Right
const results = await Promise.allSettled(
  contracts.map(c => publicClient.readContract(c))
);
```

## Agent Platform Issues

### Agent call timeout (no callback)

**Cause:** Agent Platform didn't deliver callback. Could be:
- Insufficient deposit (needs 0.33 STT)
- Invalid agent ID
- Malformed request data

**Diagnosis:** Check the request transaction on explorer. Look for `Decision` event with the request data.

### LLM returns invalid JSON

**Cause:** Qwen3-30B occasionally returns malformed JSON or extra text around the JSON.

**Impact:** Market creation fails, status stays at Created (0).

**Mitigation:** FinalV2 uses try/catch around JSON parsing. Failed parses emit `MarketCreateFailed` event and increment retry counter.

### Wrong agent ID

The correct agent IDs for Somnia Testnet:

| Agent | ID |
|-------|-----|
| LLM Inference | `12847293847561029384` |
| JSON API Request | `13174292974160097713` |
| Web Scraper | `12875401142070969085` |

### inferToolsChat selector

The correct function selector is `0xd0683905`. Using the wrong selector will cause the agent call to fail silently.

## Somnia-Specific Quirks

### High gas for simple operations

Somnia's EVM implementation requires more gas than Ethereum for certain opcodes. Always test with generous gas limits first, then optimize down.

### Block numbers increase fast

At 400ms per block, block numbers increase by ~216,000 per day. Don't use block numbers for time calculations without accounting for this.

### RPC rate limiting

The public RPC (`dream-rpc.somnia.network`) may rate-limit aggressive polling. Keep batch sizes small (5 concurrent calls) and poll intervals reasonable (15-30 seconds).

### Transaction finality

Transactions are final in 1 block (400ms). No need to wait for confirmations like on Ethereum. `waitForTransactionReceipt` returns almost immediately.

## Recovery Procedures

### ReactiveV2 loop died

```javascript
// 1. Check balance
const bal = await getBalance({ address: REACTIVE_V2 });
// 2. Top up if needed
if (bal < parseEther("35")) {
  await sendTransaction({ to: REACTIVE_V2, value: parseEther("10") });
}
// 3. Restart loops
await writeContract({ functionName: "startCreateLoop", gas: 5_000_000n });
await writeContract({ functionName: "startResolveLoop", gas: 5_000_000n });
```

### FinalV2 out of funds

```javascript
// Send STT for agent calls
await sendTransaction({
  to: FINAL_V2,
  value: parseEther("20"),
});
```

### Need to change intervals without redeployment

```javascript
// Stop current loop
await writeContract({ functionName: "stopCreateLoop", gas: 500_000n });
// Change interval
await writeContract({ functionName: "setCreateInterval", args: [9000n], gas: 200_000n });
// Restart
await writeContract({ functionName: "startCreateLoop", gas: 5_000_000n });
```

### Emergency: withdraw all funds

```javascript
await writeContract({ functionName: "stopCreateLoop", gas: 500_000n });
await writeContract({ functionName: "stopResolveLoop", gas: 500_000n });
await writeContract({ functionName: "withdrawAll", gas: 200_000n });
```
