# Troubleshooting (V5)

Common issues, root causes, and fixes for Santiora V5 on Somnia Testnet.

## Contract Architecture (V5)

The V5 pipeline has two core contracts:

| Contract | Address | Purpose |
|----------|---------|---------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` | Market storage, creation, betting, resolution |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` | LLM prompt templates and agent configuration |

V5 markets are stored in a single `mapping(uint256 => Market)` on SantioraV5. There are no separate per-market contract deployments — every market shares the same contract address.

## Market Lifecycle Issues

### Market stuck in "Created" (status 0) forever

**Symptom:** Market count increases but the market never becomes Active. Frontend shows "Creating..." indefinitely.

**Cause:** The LLM call to populate the market's question, odds, and deadline did not complete. This is often because:

1. **STT balance too low** — SantioraV5 needs > 0.24 STT to pay for an LLM agent call
2. **Agent callback never arrived** — the Somnia Agent Platform failed to deliver the callback
3. **LLM returned invalid JSON** — the response could not be parsed into question/odds/deadline

**Diagnosis:**
```javascript
// Check SantioraV5 STT balance
const balance = await publicClient.getBalance({
  address: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
});
console.log("V5 balance:", formatEther(balance), "STT");

// Check pipeline state for a specific market
const pipeline = await publicClient.readContract({
  address: SANTIORA_V5,
  abi: V5_ABI,
  functionName: "getPipeline",
  args: [BigInt(marketId)],
});
// phase 0 = Creating, phase 1 = Active, etc.
console.log("Phase:", pipeline.phase);
```

**Fix:** Fund SantioraV5 with STT:
```javascript
await walletClient.sendTransaction({
  to: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
  value: parseEther("5"), // Send 5 STT
});
```

### Market stuck in "ExecutingTools" phase

**Symptom:** Market was created but `phase` shows it is in tool execution, not yet Active.

**Cause:** The JSON API agent (`13174292974160097713`) used to fetch real-world data failed. The market retries with the error result.

**Diagnosis:** Check if the source URL is accessible. The contract attempts to call `fetchPrice(symbol)` for crypto markets or equivalent tool calls for other categories.

**Fix:** Usually self-resolves on retry. If persistent, check:
1. SantioraV5 STT balance (each tool call costs STT)
2. Source URL availability (API might be rate-limited or down)
3. Tool signature format — V5 uses `"fetchPrice(string symbol)"` Solidity-style signatures, not JSON schemas

### Market reverts to Active after resolve attempt

**Symptom:** Market shows Active (status 1) even though the deadline has passed and resolution was attempted.

**Cause:** The AI resolution returned confidence < 70% or the outcome was UNRESOLVABLE. Common reasons:

1. **Deadline not yet passed** — the resolver is called too early
2. **Insufficient data** — the source URL returned empty or stale data
3. **Ambiguous outcome** — the event genuinely could not be determined from available data

**Check:** The `confidence` and `outcome` fields on the market:
```javascript
const market = await publicClient.readContract({
  address: SANTIORA_V5,
  abi: V5_ABI,
  functionName: "markets",
  args: [BigInt(marketId)],
});

console.log("Status:", market.status);       // 1 = Active (reverted)
console.log("Outcome:", market.outcome);     // "" = unresolved
console.log("Confidence:", market.confidence); // < 70 = below threshold
console.log("Raw response:", market.rawResponse);
```

**Fix:** Wait for the next resolution cycle. The system retries with fresh data. If persistent:
1. Check the source URL still works
2. Check if the event genuinely has no clear outcome yet
3. If the market has hit its retry cap, it will be marked Failed (status 5)

### createMarket reverts

**Symptom:** Transaction to create a market reverts.

**Cause:** Unauthorized caller. Only `owner` or the designated `reactiveContract` can call `createMarket`.

**Fix:** Ensure the caller address matches the authorized address on the contract. If deploying fresh:
```javascript
await writeContract({
  address: SANTIORA_V5,
  functionName: "setReactiveContract",
  args: [REACTIVE_CONTRACT_ADDRESS],
});
```

## Contract STT Balance

### SantioraV5 runs out of STT

**Symptom:** Pipeline events stop, no new markets created, no resolutions processed.

**Diagnosis:**
```javascript
const balance = await publicClient.getBalance({
  address: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
});
console.log("V5 STT balance:", formatEther(balance));
if (balance < parseEther("1")) {
  console.log("CRITICAL: Balance below 1 STT — fund immediately");
}
```

**Fix:**
```javascript
await walletClient.sendTransaction({
  to: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
  value: parseEther("20"), // Top up with 20 STT
});
```

Estimated costs per operation:
- Market creation: ~0.24 STT per LLM call + ~0.1 STT per tool call
- Resolution: ~0.24 STT per LLM call

## Agent Platform Issues

### LLM callback not received

**Symptom:** Pipeline moves to Creating phase but never completes.

**Cause:** The Somnia Agent Platform did not deliver the LLM inference callback. Possible reasons:
- Insufficient STT deposit on the contract
- Invalid agent ID
- Malformed request data
- Agent Platform outage

**Agent IDs (Somnia Testnet):**

| Agent | ID |
|-------|-----|
| LLM Inference | `12847293847561029384` |
| JSON API Request | `13174292974160097713` |
| Web Scraper | `12875401142070969085` |

### Tool call format errors (historical)

**Symptom:** OnchainTool failures with "unknown tool" or "invalid format" errors.

**Historical bug (fixed in V5):** Earlier versions sent tool calls as JSON schema. V5 uses Solidity function signature format:
```
fetchPrice(string symbol)
```

If you see tool call errors, verify the prompt template in V5Prompts uses the correct signature format.

### LLM returns invalid JSON

**Symptom:** Market creation or resolution fails with parsing errors.

**Cause:** The LLM occasionally outputs malformed JSON or wraps JSON in markdown fences.

**Fix:** SantioraV5 wraps JSON parsing in try/catch. Failed parses retry. No manual intervention needed unless the model is consistently returning bad output.

## Frontend Issues

### Markets page shows 0 markets

**Symptom:** The `/markets` page is empty despite markets existing on-chain.

**Diagnosis:**
1. **Check browser console** for JavaScript errors (network failures, fetch errors)
2. **Verify SantioraV5 address** in `src/lib/onchain.ts`:
   ```typescript
   // Must be exactly:
   export const SANTIORA_V5 = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";
   ```
3. **Check market count manually:**
   ```javascript
   const count = await publicClient.readContract({
     address: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
     abi: [{ type: "function", name: "marketCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
     functionName: "marketCount",
   });
   console.log("Total markets:", count);
   ```
4. **Check fetchAllMarkets filter:** The function filters to `status >= 1`. Markets in Created (0) status are excluded.

**Fix:** If marketCount returns a non-zero value but the frontend still shows 0:
- Check RPC connectivity — the Somnia RPC may be rate-limiting
- Reduce polling frequency if hitting rate limits
- Verify the ABI matches the deployed contract

### RPC rate limiting

**Symptom:** Network errors, failed requests after the page has been open for a while.

**Cause:** The Somnia public RPC (`dream-rpc.somnia.network`) may rate-limit aggressive polling.

**Fix:**
- Reduce polling interval (30 seconds is the default, do not go below 15 seconds)
- Use a dedicated RPC endpoint if available
- Restart the dev server to clear cached connections

### BigInt overflow or display errors

**Symptom:** "Cannot convert a BigInt value to a number" or garbled numbers in the UI.

**Cause:** Trying to pass a `bigint` directly to `Number()` or rendering it as a React child.

**Fix:** Use viem's `formatUnits` or `formatEther`:
```typescript
import { formatUnits } from "viem";

// Wrong
<div>{susdBalance}</div>

// Correct
<div>{formatUnits(susdBalance, 18)}</div>
```

### Activity feed stuck on "Loading"

**Symptom:** The activity feed never loads, shows spinner indefinitely.

**Cause:** The `useOnchainActivity` hook uses raw topic-based event decoding. If contract events changed between versions or the RPC endpoint blocks `eth_getLogs`, the feed breaks.

**Fix:**
1. Check browser console for `getLogs` errors
2. Verify the event topic hashes match the current SantioraV5 events
3. If the RPC blocks `getLogs`, the feed falls back to static data — this is expected behavior on some public endpoints

## Betting Issues

### SUSD approve succeeds but bet reverts

**Symptom:** You approved SUSD spending but the bet transaction reverts.

**Cause:** The approve transaction used insufficient gas. On Somnia, `approve` needs exactly 5,000,000 gas. With less gas, the transaction may "succeed" (it gets included in a block) but the actual storage write does not execute — allowance remains 0.

**Diagnosis:**
```javascript
const allowance = await publicClient.readContract({
  address: "0xB553c0003C3F0419abD358A2edD16191fC86ef90", // SUSD
  abi: [{ type: "function", name: "allowance", inputs: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
  ], outputs: [{ type: "uint256" }], stateMutability: "view" }],
  functionName: "allowance",
  args: [userAddress, SANTIORA_V5],
});
console.log("Allowance:", allowance); // 0 = approve failed
```

**Fix:** Always use 5,000,000 gas for approve. The `usePlaceBet` hook in the frontend already does this — manual transactions must match.

### "insufficient balance" error

**Cause:** Your wallet does not have enough SUSD.

**Fix:** Get test SUSD from the faucet at `/faucet` or use the Faucet contract directly:
```javascript
await writeContract({
  address: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
  abi: FAUCET_ABI,
  functionName: "claim",
});
```

### "market not active" revert

**Cause:** The market is not in Active (status 1) state.

| Status | Value | Explanation |
|--------|-------|-------------|
| Created | 0 | AI is still generating the market |
| Resolving | 2 | Resolution in progress |
| Resolved/Settled | 3/4 | Market already resolved |
| Failed | 5 | Market creation or resolution failed |

**Fix:** Check market status before betting. The frontend disables the bet button for non-active markets.

### Wallet rejects the transaction

**Cause:** You dismissed the wallet prompt (MetaMask/RainbowKit dialog).

**Fix:** No code fix needed. The `usePlaceBet` hook handles this gracefully — it sets state to `"error"` with message "Transaction rejected by user" and shows a "Try again" button.

## Deployment Issues

### "Status: reverted" on contract deploy

**Cause:** Gas limit too low. SantioraV5 is a large contract and Somnia gas estimation differs from Ethereum.

**Fix:** Let viem estimate gas automatically, or use a buffer:
```javascript
const estimate = await publicClient.estimateGas({
  account: deployerAddress,
  data: bytecode,
  args: constructorArgs,
});
const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: constructorArgs,
  gas: (estimate * 130n) / 100n, // 30% buffer
});
```

### "InsufficientBalance" on agent subscription

**Cause:** Contract balance below 32 STT — Somnia's minimum for subscription owners.

**Fix:** Fund with at least 35 STT:
```javascript
await walletClient.sendTransaction({
  to: contractAddress,
  value: parseEther("40"),
});
```

## Somnia-Specific Quirks

### Block Numbers Increase Rapidly

At 400ms per block, block numbers increase by ~216,000 per day. Never use block numbers for time calculations.

### Transaction Finality

Transactions are final in 1 block (400ms). `waitForTransactionReceipt` returns almost immediately — there is no need to wait for multiple confirmations.

### RPC WebSocket

Available at `wss://dream-rpc.somnia.network/ws` for real-time subscriptions. Note that the activity feed uses polling as a fallback since some RPC providers limit WebSocket connections.

## Recovery Procedures

### SantioraV5 out of STT funds

```javascript
// Send STT for agent calls and operations
await walletClient.sendTransaction({
  to: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
  value: parseEther("20"),
});
```

After funding, markets in Creating phase will resume on the next pipeline cycle.

### Frontend shows wrong contract address

Check and update `src/lib/onchain.ts`:
```typescript
export const SANTIORA_V5 = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";
export const SANTIORA_V5_PROMPTS = "0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7";
```

And `src/lib/config.ts`:
```typescript
export const CONTRACTS = {
  SANTIORA_V5: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
  SUSD: "0xB553c0003C3F0419abD358A2edD16191fC86ef90",
  FAUCET: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
};
```

If redeployed to new addresses, update both files.

### Quick Health Check

Run this script to verify the V5 pipeline is healthy:

```javascript
import { createPublicClient, http, parseEther } from "viem";
import { somniaTestnet } from "./config";

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

const SANTIORA_V5 = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";

async function healthCheck() {
  // 1. Contract balance
  const balance = await publicClient.getBalance({ address: SANTIORA_V5 });
  console.log("V5 STT balance:", formatEther(balance));

  // 2. Market count
  const count = await publicClient.readContract({
    address: SANTIORA_V5,
    abi: [{ type: "function", name: "marketCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
    functionName: "marketCount",
  });
  console.log("Market count:", count);

  // 3. Stats
  const stats = await publicClient.readContract({
    address: SANTIORA_V5,
    abi: [{
      type: "function", name: "getStats", inputs: [], outputs: [{
        type: "tuple", components: [
          { type: "uint256", name: "totalCreated" },
          { type: "uint256", name: "totalResolved" },
          { type: "uint256", name: "totalFailed" },
          { type: "uint256", name: "totalRejected" },
        ]
      }], stateMutability: "view",
    }],
    functionName: "getStats",
  });
  console.log("Stats:", {
    created: stats.totalCreated,
    resolved: stats.totalResolved,
    failed: stats.totalFailed,
    rejected: stats.totalRejected,
  });

  // 4. Health assessment
  const warnings = [];
  if (balance < parseEther("1")) warnings.push("V5 STT balance < 1 — fund immediately");
  if (stats.totalFailed > 0) warnings.push(`${stats.totalFailed} failed markets`);

  console.log(warnings.length === 0 ? "HEALTHY" : "WARNINGS:", warnings);
}

healthCheck().catch(console.error);
```

## Key Contract Addresses

| Contract | Address | Network |
|----------|---------|---------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` | Somnia Testnet 50312 |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` | Somnia Testnet 50312 |
| SUSD Token | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Somnia Testnet 50312 |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Somnia Testnet 50312 |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia Testnet 50312 |
| RPC HTTP | `https://dream-rpc.somnia.network` | — |
| RPC WS | `wss://dream-rpc.somnia.network/ws` | — |
| Explorer | `https://shannon-explorer.somnia.network` | — |