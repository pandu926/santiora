# Frontend V3 Integration Audit

## Summary

The frontend successfully reads stats from V3 coord (getStats/getRulesState/rules) but its V3 creator address is stale, event decoding is completely broken (fabricated topic hashes), and V3 pipeline events (CreatorBrain, ResolverFinal, PipelineFailed) are invisible to users. Betting is structurally disconnected from V3 because V3 registers markets with isSUSD=false and does not deploy AMM contracts.

---

## 1. Address Coverage

### V3 Addresses — Status

| Address | Variable | Deployed | Status |
|---------|----------|----------|--------|
| Coord V3 | `SANTIORA_FINAL_V3` | `0x9f2DEA...A18B` | CORRECT (`onchain.ts`:12) |
| Creator V3 | `SANTIORA_V3_CREATOR` | `0xE53387...B22E` | STALE — deployed is `0x48d390...1a7F` (`onchain.ts`:13) |
| Resolver V3 | `SANTIORA_V3_RESOLVER` | `0xA4DC67...b324` | CORRECT (`onchain.ts`:14) |
| Registry V2 | `MARKET_REGISTRY` | `0xd68d35...A46B` | CORRECT (`onchain.ts`:17) |

### V2 Addresses Still in Active Use

| Address | Variable | Used Where |
|---------|----------|------------|
| `0x699924...3ee8` (V2 coord) | `SANTIORA_FINAL_V2` | Defined but never read from (`onchain.ts`:11) |
| `0x410541...Fd55` (V1 coord) | `SANTIORA_FINAL` | Defined, never read from (`onchain.ts`:10) |
| `0x9a907c...d248` (Reactive V2) | `SANTIORA_REACTIVE_V2` | Active use in `fetchReactiveV2Stats` (`onchain.ts`:336) and `useOnchainActivity` (`useOnchainActivity.ts`:166) |
| `0xf9032d...B39D` (Reactive V1) | `SANTIORA_REACTIVE` | Used by `fetchAgentMetrics` (`onchain.ts`:213) |
| `0x307df7...5972` | `CONTRACTS.MARKET_FACTORY` | Used by `useMarkets` hook (`useMarkets.ts`:33,41). This is V1 MarketFactoryLite, unrelated to V3 pipeline. |
| `0xFD116...5D5` | `CONTRACTS.ORCHESTRATOR` | Defined in `config.ts`:23, never referenced. Dead config. |
| `0xbf7A28...A44` | `CONTRACTS.BRAIN` | Defined in `config.ts`:24, never referenced. Dead config. |
| `0x037Bb9...6776` | `CONTRACTS.PLATFORM` | Used only as display address in AI Dashboard (`ai/page.tsx`:190). |

### Critical Gaps

**GAP A — V3 Creator address stale.** `onchain.ts`:13 defines `0xE53387...B22E` but the deployed V3 creator is `0x48d3908C1FB1945302728259907F1EDDE2Cf1a7F`. This means any call to the creator through the frontend would hit the wrong/dead contract. Fortunately no frontend code actually calls the creator contract (it's only displayed in the AI Dashboard contract list at `ai/page.tsx`:186).

**GAP B — `config.ts` missing V3 entries.** `config.ts`:20-28 has `SANTIORA_FINAL`, `SANTIORA_FINAL_V2`, no `SANTIORA_FINAL_V3`. The V3 addresses are only in `onchain.ts`. If any code uses `CONTRACTS.SANTIORA_FINAL_V3`, it will be `undefined`.

**GAP C — `useMarkets` reads from V1 MarketFactory.** `useMarkets.ts`:33-43 uses `CONTRACTS.MARKET_FACTORY` (0x307df7...5972) via wagmi `useReadContract`. This is the old V1 MarketFactoryLite. It has no relationship to V3 market lifecycle. Users who call this hook will see stale V1 data, not V3 pipeline markets.

---

## 2. ABI Coverage

### V3 Coord ABI (used via `FINALV2_ABI` at `onchain.ts`:247-251)

| Function | V3 Signature | Frontend ABI | Match? |
|----------|-------------|--------------|--------|
| `getStats()` | 5 outputs: (total, created, resolved, failed, avgConfidence) | 5 uint256 outputs | YES |
| `getRulesState()` | 4 outputs: (lastScan, todayCount, dayStart, balance) | 4 uint256 outputs | YES |
| `rules()` | Struct with 7 fields (scanInterval, maxMarketDuration, minMarketDuration, maxMarketsPerDay) | 7 outputs (uint256, uint8, uint8, uint256, uint256, uint256, uint256) | PARTIAL — V3 `Rules` struct has 4 fields, but ABI expects 7. `fetchFinalV2Stats` (`onchain.ts`:326) destructures `[si, mrc, mrr, , , , mmpd]` which maps fields incorrectly (maxRetryCreate/maxRetryResolve don't exist in V3 rules). The `rules` ABI fragment is inherited from V2 coord and doesn't match V3. |
| `getMarket(id)` | 8 outputs: (question, odds, deadline, category, status, outcome, confidence, data) | NOT IN `FINALV2_ABI` | MISSING |
| `getMarketCount()` | 1 output: uint256 | NOT IN `FINALV2_ABI` | MISSING |
| `getNextCategory()` | 1 output: string | NOT IN `FINALV2_ABI` | MISSING |
| `canCreateMarket(string)` | 2 outputs: (bool, string) | NOT IN `FINALV2_ABI` | MISSING |
| `canCreateMarket()` | 2 outputs: (bool, string) | NOT IN `FINALV2_ABI` | MISSING |

### Registry ABI (`REGISTRY_ABI` at `onchain.ts`:20-25)

`getMarket` ABI matches RegistryV2's 9-output signature (`onchain.ts`:21). `getMarketCount`, `getActiveCount`, `getResolvedCount` all match. This is correctly typed.

### Critical Gaps

**GAP D — `rules()` ABI mismatch.** `onchain.ts`:250 has 7-output ABI fragment for `rules()` (leftover from V2 coord). V3's `Rules` struct has 4 fields. The destructuring at `onchain.ts`:326 extracts `scanInterval`, `maxRetryCreate`, `maxRetryResolve`, `maxMarketsPerDay` by positional skip, mislabeling V3 fields. Field positions differ between V2 and V3. The scan interval value happens to land in the first slot (both V2 and V3 have it first), so it coincidentally works, but the other decoded values are garbage.

**GAP E — V3 coord getMarket/getMarketCount/getNextCategory ABIs missing.** `FINALV2_ABI` only has getStats/getRulesState/rules. The frontend reads market data from the **Registry** (via `REGISTRY_ABI`), not from the V3 coord. This means the frontend sees registry state (address, question, odds, deadline, category, status, outcome, confidence, isSUSD) but misses coord-only fields: `sourceUrl`, `selector`, `data` (the JSON API details stored in V3 markets struct). See also Gap H.

---

## 3. Event Coverage

### How the Frontend Tries to Get Events

`useOnchainActivity.ts` (lines 163-186):
- Polls with `client.getLogs()` from two addresses: `SANTIORA_REACTIVE_V2` and `SANTIORA_FINAL_V3`
- No topic filter — gets ALL logs from both contracts (correct approach for broad coverage)
- Calls `decodeReactiveLog(log)` and `decodeFinalLog(log)` to classify
- Poll interval: 15s. Reactive fires every ~4500 blocks. At Somnia 400ms finality, that's ~30 minutes between triggers. A 15s interval catches all events with negligible lag.

### Event Decoding — BROKEN

**V3 final coord events** (from `SantioraFinalV3.sol`:74-81):
- `MarketCreating(uint256,string)` -> topic0 from V3
- `MarketActive(uint256,string,uint256,uint256)` -> topic0 from V3
- `MarketResolving(uint256)` -> topic0 from V3
- `MarketResolved(uint256,string,uint256)` -> topic0 from V3
- `PipelineFailed(uint256,string)` -> topic0 from V3
- `AutoRegistered(uint256,address)` -> topic0 from V3
- `Decision(uint256,string,string)` -> topic0 from V3

**`FINAl_TOPICS`** (lines 30-42) contains fabricated topic0 prefixes:
```
"0xd7421b46dbf47b88" — fabricated (looks like human-readable hex, not keccak output)
"0x4780b74db45b2a5b" — fabricated
"0xf6af599a778ddc53" — fabricated
...
```
None of these match real keccak256 event signature hashes. The `decodeFinalLog` function switches on the first 18 hex chars of topic0, but V3 events have real keccak256-derived topic0 hashes. Every V3 event falls through to `default: return null` (`useOnchainActivity.ts`:133). The activity feed shows zero events from the V3 coord.

**`REACTIVE_TOPICS`** (lines 23-28) — these have different-looking prefixes (e.g., `0xa194c386d94467d3`), possibly real. But the Reactive contract may emit different topics now.

### Creator/Resolver Events — COMPLETELY MISSING

V3 Creator events (`SantioraV3Creator.sol`:53-57): `CreatorStarted`, `CreatorData`, `CreatorBrain`, `CreatorQuality`, `CreatorFailed` — none are subscribed to anywhere.

V3 Resolver events (`SantioraV3Resolver.sol`:46-50): `ResolverStarted`, `ResolverData`, `ResolverBrain`, `ResolverFinal`, `ResolverFailed` — none are subscribed to anywhere.

### Critical Gaps

**GAP F — V3 event decoding is completely broken.** All 8 coord events + 5 creator events + 5 resolver events = 18 on-chain event types that the frontend receives but cannot decode. `FINAl_TOPICS` entries are fabricated strings that will never match real keccak256 hashes. File: `useOnchainActivity.ts`:30-42 (topic map) and lines 76-138 (decoder switch that also uses fabricated prefixes).

**GAP G — No creator/resolver log polling.** `useOnchainActivity.ts` polls only SANTIORA_REACTIVE_V2 and SANTIORA_FINAL_V3 for logs (line 166-167). It does NOT poll SANTIORA_V3_CREATOR or SANTIORA_V3_RESOLVER. Even if topic decoding were fixed, creator/resolver events would not be seen.

---

## 4. AI Pipeline Visibility

### What the User Sees

| Surface | Data Source | Real On-Chain? |
|---------|------------|----------------|
| AI Dashboard (`/ai`) | `fetchFinalV2Stats` + `fetchReactiveV2Stats` | YES — reads V3 `getStats/getRulesState/rules` and Reactive V2 stats |
| Activity Feed (`/activity`) | `useOnchainActivity` → raw logs | PARTIAL — gets logs but can't decode V3 events (Gap F) |
| Transparency (`/transparency`) | `fetchAIActivity()` from `api.ts` | NO — entirely fabricated (hardcoded loop, `api.ts`:233-245) |
| AI Feed (sidebar) | `useAgentActivity` hook | NO — generates fake data from metric counts (`useAgentActivity.ts`:19-41) |
| Resolution Panel | `useResolution` → REST API | NO — calls external API, not on-chain events (`useResolution.ts`:31) |
| LiveFeed toasts | `LiveFeed.tsx` | NO — `toasts` state is initialized to `[]` and never updated (`LiveFeed.tsx`:26) |

### The Hackathon Story Gap

V3's value proposition: "AI as the protocol operator." Users can verify every decision on-chain. But the frontend:

1. **Does not show CreatorBrain output.** When the V3 creator emits `CreatorBrain(marketId, response)` containing the raw LLM JSON with question, odds, reasoning — this event lands on-chain but is invisible in the frontend.

2. **Does not show CreatorQuality decision.** When the quality gate approves/rejects a market with reasoning in `CreatorQuality(marketId, approved, response)` — invisible.

3. **Does not show ResolverFinal output.** When resolution runs and emits `ResolverFinal(marketId, outcome, confidence)` with the final verdict and confidence — invisible. The market detail page shows resolutionConfidence from the registry (which does get populated by V3), but not the reasoning/data that accompanied the resolution.

4. **Does not show PipelineFailed reasoning.** When `PipelineFailed(marketId, reason)` fires (duplicate question, registry failure, low confidence), users have no way to know what happened.

5. **Does not show Decision events.** V3 emits `Decision(marketId, action, reason)` for throttling (skip due to interval/daily_limit/topic_limit) — invisible.

### Critical Gaps

**GAP H — Pipeline transparency zero.** Users cannot see the AI pipeline working. The transparency page (`transparency/page.tsx`) has the tagline "All AI decisions are onchain — verify everything" but shows fabricated data from `fetchAIActivity()` which generates hardcoded fake entries. The real on-chain data exists but cannot be decoded (Gap F).

**GAP I — Resolution flow is API-dependent, not on-chain.** `useResolution` hook (`useResolution.ts`:30-31) calls `https://santiora.rbexp.com/api/markets/{address}/resolution`. If the backend API is down, the resolution panel shows nothing — despite all resolution data being on-chain in V3 markets and resolver events.

---

## 5. Betting Wiring

### How V3 Markets Flow to Betting

1. V3 `finalizeCreated` calls `registry.registerMarket(marketAddr, ..., 1, false)` — `isSUSD=false` (`SantioraFinalV3.sol`:181)
2. `marketAddr` is deterministic: `address(uint160(uint256(keccak256(abi.encodePacked(address(this), marketId)))))` — this is a calculated address, NOT a deployed contract.
3. Frontend `fetchAllMarkets` reads registry getMarket, sees `isSUSD=false` (`onchain.ts`:75)
4. Frontend sets `volume: isSUSD ? "500" : "0"` (`onchain.ts`:98)
5. `useOnchainMarkets` sets `isSusd = m.volume !== "0"` → false (`useOnchainMarkets.ts`:35)
6. Market detail page hides bet panel: `{isSusdMarket && isMarketActive && (...)}` (`markets/[address]/page.tsx`:299)
7. `usePlaceBet` is never invoked for V3 markets.

### Separation is BY DESIGN

V3 is a market registration + lifecycle coordinator. It does NOT deploy AMM contracts. The V2 pipeline had separate factory contracts (`MarketFactoryLite`, `PredictionMarketSUSD`) that handled the AMM side. V3 intentionally separated concerns — the coord handles AI pipeline, and betting infrastructure is a separate concern.

The frontend correctly gates betting on `isSUSD` — V3 markets showing `isSUSD=false` means no bet button appears. This is correct, not a bug.

### What's Missing

There is no code path that:
1. Creates a PredictionMarketSUSD contract for a V3-active market
2. Links that AMM contract to the V3 market via registry
3. Updates the registry `isSUSD` flag

Until V3 integrates with an AMM/deployment step, V3 markets are read-only lifecycle entities. The frontend accurately reflects this — the gap is in the contract layer, not the frontend.

### Critical Gaps

**GAP J — V3 markets have no AMM path.** `isSUSD=false` in V3 `finalizeCreated` (`SantioraFinalV3.sol`:181) means frontend correctly hides betting UI. No code exists to bridge V3 market creation to AMM deployment. This is a contract-layer architectural gap that flows through to the frontend.

---

## Top 5 Gaps Ranked by Severity

| Rank | Severity | Gap | File:Line | Description |
|------|----------|-----|-----------|-------------|
| 1 | **CRITICAL** | GAP F | `useOnchainActivity.ts`:30-42, 76-138 | V3 event decoding completely broken. All 18 event types (coord + creator + resolver) are received via `getLogs` but `FINAl_TOPICS` uses fabricated topic0 prefixes. No V3 event reaches the UI. Fix: compute keccak256 of actual V3 event signatures and replace fabricated hashes. |
| 2 | **CRITICAL** | GAP H | `api.ts`:231-246, `transparency/page.tsx`:15, `useAgentActivity.ts`:19-41 | AI pipeline transparency is entirely fake data. Transparency page, AI activity feed, and agent status all generate synthetic data instead of reading on-chain events. CreatorBrain/ResolverFinal output is on-chain but invisible. |
| 3 | **HIGH** | GAP A | `onchain.ts`:13 | SANTIORA_V3_CREATOR address is stale (`0xE53387` vs deployed `0x48d390`). Though no frontend code calls it, the AI Dashboard displays a dead address to users. |
| 4 | **HIGH** | GAP E | `onchain.ts`:247-251 | `FINALV2_ABI` missing V3 coord functions: getMarket, getMarketCount, getNextCategory, both canCreateMarket overloads. Frontend reads market data from Registry (which works) but loses V3-only fields: sourceUrl, selector, data. |
| 5 | **HIGH** | GAP G | `useOnchainActivity.ts`:166-167 | No log polling for SANTIORA_V3_CREATOR or SANTIORA_V3_RESOLVER addresses. Even after fixing topic decoding (Gap F), CreatorBrain/CreatorQuality/ResolverFinal events will never be fetched because only coord + reactive addresses are polled. |