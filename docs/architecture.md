# Architecture

## System Overview

Santiora V5 operates as a three-layer autonomous system built around a **yield-and-resume LLM pipeline**. Each layer communicates through on-chain function calls — no off-chain infrastructure required for core operations.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCHEDULING LAYER                          │
│                                                                  │
│  SantioraReactiveV5                                             │
│  ├── scheduleSubscriptionAtBlock(block + interval)  → create     │
│  └── scheduleSubscriptionAtBlock(block + interval)  → resolve    │
│                                                                  │
│  Fires: ~96 times/day | Cost: ~0.5 STT/day                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ _onEvent() → createMarket / resolveMarket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION LAYER                       │
│                                                                  │
│  SantioraV5 + V5Pipeline (yield-and-resume state machine)       │
│  ├── createMarket(category)                                      │
│  │   ├── _dispatchInferToolsChat(roles, messages, tools)        │
│  │   ├── onOrchestrateResult() → yield tool_calls                │
│  │   ├── onToolResult() → execute via JSON API agent             │
│  │   └── _resumeOrchestration() → resume with tool results      │
│  ├── resolveMarket(marketId) → same yield-and-resume pipeline   │
│  └── _onFinalResponse() → parse JSON, register market           │
│                                                                  │
│  Cost: ~0.72 STT per market (single pipeline cycle)             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ registers market → MarketRegistry
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MARKET LAYER                              │
│                                                                  │
│  MarketRegistry          PredictionMarketSUSD                   │
│  ├── getMarket(id)       ├── buyYes(amount)                     │
│  ├── getMarketCount()    ├── buyNo(amount)                      │
│  └── getActiveCount()    ├── claimWinnings()                    │
│  ├── isDuplicate(q)      └── ShareToken (YES/NO ERC20)          │
│  └── registerMarket()                                           │
│                                                                  │
│  Users interact here: bet, claim, view positions                │
└─────────────────────────────────────────────────────────────────┘
```

## The Yield-and-Resume Pattern

This is the core innovation of V5. Instead of making separate agent calls for data fetching and LLM interpretation (V4's callback-heavy approach), the LLM is given **OnchainTool definitions** and decides through `inferToolsChat` what data to fetch. The contract executes the tool calls, feeds results back, and the LLM produces the final output.

### Pipeline Phases

The `V5Pipeline` abstract contract manages a state machine with 5 phases:

```
     ┌──────────┐
     │   Idle   │ ← initial state, pipeline not in use
     └────┬─────┘
          │ _dispatchInferToolsChat()
          ▼
     ┌──────────────┐
     │ Orchestrating │ ← LLM thinking, may yield tool_calls or stop
     └──────┬───────┘
            │
     ┌──────┴──────────┐
     │                  │
     ▼ (tool_calls)     ▼ (stop)
┌───────────────┐  ┌──────┐
│ExecutingTools │  │ Done │ → _onFinalResponse()
└───────┬───────┘  └──────┘
        │ all tools complete
        ▼
┌──────────┐
│ Resuming │ → feeds tool results back to LLM → back to Orchestrating
└──────────┘
```

### Step-by-Step: Market Creation

```
Step 1 — TRIGGER
  SantioraReactiveV5._onEvent()
      → v5.createMarket("technology")

Step 2 — ORCHESTRATE
  SantioraV5.createMarket()
      → Build prompt from V5Prompts (system role + user role)
      → _dispatchInferToolsChat(marketId, roles, messages, tools)
          → Phase = Orchestrating
          → createRequest(LLM_AGENT_ID, inferToolsChat selector, payload)

  LLM Agent (Qwen3-30B, inferToolsChat) processes:
  <system>You are an autonomous prediction market creator...</system>
  <user>Create a prediction market in the 'technology' category...</user>
  [Tools available: fetchPrice, fetchSportsFixture, fetchHeadline, fetchJSON]

Step 3 — YIELD
  LLM decides it needs data → returns:
    finish_reason: "tool_calls"
    tool_calls: [
      { tool_call_id: "call_1", function: fetchHeadline("AI regulation") }
    ]

  onOrchestrateResult() callback fires:
      → _processOrchestrateResult()
          → finishReason is "tool_calls" → _handleToolYield()
              → Phase = ExecutingTools
              → Save conversation state (roles, messages)
              → For each tool_call: _executeToolCall()

Step 4 — EXECUTE
  For each tool call:
      → calldata_.routeToolCall()
          → V5ToolRouter: decode ABI selector, return (url, selector)
          → fetchPrice("ETH") → ("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", "ethereum.usd")
          → createRequest(JSON_AGENT_ID, fetchString selector, payload)

  JSON API Agent fetches from CoinGecko, returns: "3250.42"

  onToolResult() callback fires:
      → Decode result, store in pipeline.toolResults[toolIdx]
      → pipe.completedTools++
      → _checkAllToolsDone()

Step 5 — RESUME
  All tools done:
      → Phase = Resuming
      → _resumeOrchestration()
          → Reconstruct conversation:
            [system prompt, user message, tool result as JSON]
          → _dispatchInferToolsChat(marketId, roles_with_tools, messages_with_tools)

  LLM Agent resumes with tool results:
  <system>...</system>
  <user>Create a prediction market...</user>
  <tool>{"tool_call_id":"call_1","content":"fastai/fastai"}</tool>

  LLM now has real data → returns:
    finish_reason: "stop"
    response: {
      "question": "Will fastai/fastai exceed 30,000 GitHub stars by June 12, 2026?",
      "odds": 72,
      "deadline": "2026-06-12",
      "category": "technology",
      "reasoning": "Currently trending at 27.5k stars with 200+/week growth rate...",
      "source_url": "https://github.com/fastai/fastai"
    }

Step 6 — FINALIZE
  onOrchestrateResult() → finishReason is "stop"
      → _finalizePipeline() → Phase = Done
      → _onFinalResponse(marketId, response)
          → SantioraV5._onFinalResponse()
              → _finalizeCreation()
                  → Parse JSON: question, odds, source_url
                  → Validate odds (bound 1-99), calculate deadline
                  → Check duplicate via registry
                  → status = Active
                  → Emit MarketActive(marketId, question, odds, deadline)
```

### Step-by-Step: Market Resolution

Resolution uses the same yield-and-resume pipeline, but with a resolution prompt instead of a creation prompt:

```
Step 1 — TRIGGER
  SantioraReactiveV5._onEvent()
      → Scan markets where deadline < now and status == Active
      → v5.resolveMarket(marketId)

Step 2 — ORCHESTRATE
  _startResolution()
      → Build resolution prompt (includes question, original odds, deadline, source URL)
      → _dispatchInferToolsChat(marketId, roles, messages, tools)
      → Phase = Orchestrating

Step 3 — YIELD
  LLM fetches current data via tools (same 4 tools)
      → e.g., fetchPrice("ETH") to get current price
      → Phase = ExecutingTools

Step 4 — EXECUTE
  JSON API agent fetches real-time data
      → Tool results stored in pipeline state

Step 5 — RESUME
  LLM resumes with current data → compares against market threshold
      → Returns: {"outcome":"YES","confidence":94,"reasoning":"...","evidence":"fetched value: 3300","source_url":"..."}

Step 6 — FINALIZE
  _finalizeResolution()
      → Check for UNRESOLVABLE (insufficient data)
      → Validate outcome string and confidence >= threshold (default 70)
      → status = Resolved
      → Emit MarketResolved(marketId, outcome, confidence)
```

## OnchainTool Format

Tools are defined as `OnchainTool` structs passed to `inferToolsChat`:

```solidity
struct OnchainTool {
    string signature;   // Solidity function signature: "fetchPrice(string symbol)"
    string description; // Human-readable: "Fetch current USD price of a cryptocurrency"
}
```

The LLM emits ABI-encoded tool calldata (4-byte selector + encoded arguments). `V5ToolRouter.routeToolCall()` decodes the selector and maps it to a real JSON API URL with a dot-notation selector for data extraction.

| Tool Signature | Data Source | Example URL |
|---------------|-------------|-------------|
| `fetchPrice(string)` | CoinGecko | `api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` |
| `fetchSportsFixture(string)` | TheSportsDB | `thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328` |
| `fetchHeadline(string)` | GitHub | `api.github.com/search/repositories?q=AI+regulation&sort=stars&per_page=1` |
| `fetchJSON(string,string)` | Any JSON API | User-specified URL with dot-notation path |

## State Machine Internals

### PipelineState

```solidity
struct PipelineState {
    Phase phase;               // Current phase: Idle → Orchestrating → ExecutingTools → Resuming → Done
    uint8 iteration;           // How many resume cycles have occurred
    uint8 totalPendingTools;   // Number of tools the LLM requested
    uint8 completedTools;      // How many tools have returned results
    bool isResolve;            // true = resolution pipeline, false = creation pipeline
    string[] savedRoles;       // Conversation roles saved during yield (for resume)
    string[] savedMessages;    // Conversation messages saved during yield
    string[] toolCallIds;      // LLM-generated tool call IDs
    string[] toolResults;      // Tool execution results (filled as they arrive)
    uint256[] toolRequestIds;  // Platform request IDs for each tool
}
```

State is **transient** — when the pipeline reaches `Phase.Done`, all arrays are deleted via `_cleanupPipeline()` to reclaim storage.

### Replay Protection

Every platform callback checks `_requestConsumed[requestId]`. If a callback fires twice (platform edge case), the second invocation is silently ignored — this prevents double-processing of tool results or final responses.

### Iteration Limit

The pipeline caps at `MAX_ITERATIONS = 3` resume cycles. If the LLM requests tools more than 3 times without producing a final response, the pipeline finalizes with whatever response exists. If no response exists at all, `_onPipelineFailed()` fires.

## Component Responsibilities

### SantioraReactiveV5

**Role:** Autonomous scheduler. Zero logic beyond "fire at the right time."

- Uses `scheduleSubscriptionAtBlock` (one-shot triggers) — no per-block overhead
- Each callback re-schedules the next one in the same transaction
- Two independent loops: create and resolve with separate intervals
- Round-robin category selection (sports, crypto, finance, technology)
- Resolve handler scans markets, skips non-active/non-expired, batches up to 10 per fire
- Gas limit: 200M per callback (configurable via admin)

### SantioraV5

**Role:** LLM orchestrator and market lifecycle manager.

- Inherits `V5Pipeline` for the state machine
- Creates markets: builds prompts, dispatches to LLM, parses JSON response, registers markets
- Resolves markets: fetches current data, compares against threshold, enforces confidence minimum
- Market lifecycle: `Creating → Active → Resolving → Resolved` (or `Failed` on error)
- Access control: `onlyOwner` (admin) and `onlyAuthorized` (owner or reactive contract)
- DevOps: withdrawable ETH, configurable rules, updatable categories and registry

### V5Pipeline

**Role:** Abstract yield-and-resume state machine.

- Manages the full `inferToolsChat` cycle: dispatch, yield, execute, resume, finalize
- Tool parallelization: all tool calls from a single yield execute concurrently
- Hook points: `_onFinalResponse()` and `_onPipelineFailed()` (implemented by SantioraV5)
- Storage hygiene: deletes transient pipeline arrays on completion
- Fully abstract — could be reused by any contract needing LLM-orchestrated tool execution

### V5ToolRouter

**Role:** Maps LLM tool calldata to real JSON API requests.

- Library: no state, pure functions
- Decodes ABI selector from calldata bytes
- Routes to CoinGecko price endpoints with symbol-to-ID mapping
- Routes to TheSportsDB league endpoints with league-to-ID mapping
- Routes to GitHub search API for trending repositories
- Generic `fetchJSON` passthrough for arbitrary URLs

### V5Prompts

**Role:** External prompt builder, deployed separately.

- Keeps SantioraV5 under the contract size limit
- Two prompts: `createMarketPrompt` and `resolveMarketPrompt`
- Stateless: pure functions, no storage
- Can be redeployed independently to refine LLM behavior without touching SantioraV5

### V5Helpers

**Role:** JSON parsing, date formatting, string utilities.

- `jsonString(json, key)` — extract string field from JSON
- `jsonUint(json, key)` — extract uint field from JSON
- `toDateStr(timestamp)` — format block timestamp as YYYY-MM-DD
- `toString(uint)` — convert uint to decimal string
- `bound(value, min, max)` — clamp a number
- `truncate(str, maxLen)` — cut string to max length
- `deadlineDays(json, now)` — parse deadline field and calculate days until
- `contains(haystack, needle)` — substring check

## Network Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Frontend   │────▶│  Somnia RPC  │────▶│   Somnia Validators  │
│  Next.js 15  │◀────│  dream-rpc   │◀────│   (execute txs)      │
└──────────────┘     └──────────────┘     └──────────────────────┘
       │                                           │
       │ wagmi/viem                                │ Native Reactivity
       │ readContract                              │ scheduleSubscriptionAtBlock
       ▼                                           ▼
┌──────────────┐                          ┌──────────────────────┐
│   User's     │                          │   Agent Platform     │
│   Wallet     │                          │   (0x037Bb9...)      │
│  MetaMask    │                          │                      │
└──────────────┘                          │ LLM Agent (Qwen3-30B)│
                                          │ inferToolsChat        │
                                          │                      │
                                          │ JSON API Agent        │
                                          │ fetchString           │
                                          │                      │
                                          │ Subcommittee: 3 nodes │
                                          │ Per-agent cost: 0.07  │
                                          └──────────────────────┘
```

## Key Design Decisions

### Why Yield-and-Resume over Sequential Agent Calls?

| Approach | Agent calls/market | STT/market | Failure modes |
|----------|-------------------|------------|---------------|
| V4: Sequential (fetch → resolve → verify) | 3+ | ~2 STT | Any callback hangs the chain; complex retry logic |
| V5: Yield-and-Resume | 1 pipeline cycle | ~0.72 STT | Single pipeline with replay protection, clean failure handling |

The LLM selects which tools to call based on what it actually needs — no wasted agent calls for irrelevant data. The conversation context (system prompt + tool results) is carried through the pipeline, enabling the LLM to reason across the full cycle.

### Why scheduleSubscriptionAtBlock over BlockTick?

| Approach | Callbacks/day | Cost/day | Sustainability |
|----------|--------------|----------|----------------|
| BlockTick (every block) | 216,000 | ~112 STT | 40 STT lasts 9 hours |
| scheduleSubscriptionAtBlock | 96 | ~0.5 STT | 40 STT lasts 80+ days |

BlockTick fires every 400ms block regardless of whether work is needed. `scheduleSubscriptionAtBlock` fires exactly when scheduled — zero idle gas.

### Why On-Chain AI (not off-chain oracles)?

- **Verifiable:** Every agent call is a transaction with input/output on-chain
- **Trustless:** No centralized API server that can be shut down
- **Autonomous:** No cron job server to maintain
- **Composable:** Other contracts can call the same agents
- **Somnia-native:** Uses primitives impossible on other chains
- **Tool-gated:** LLM can only access data through the 4 defined OnchainTools — no arbitrary internet access, no prompt injection risk

### Why Separate V5Prompts Contract?

Solidity imposes a 24,576 byte contract size limit. V5's pipeline logic, registry integration, and JSON parsing push SantioraV5 close to this boundary. Moving prompt construction to a separate `V5Prompts` contract keeps SantioraV5 within limits while also enabling prompt iteration without redeploying the main contract.

### Why Pipeline Storage Cleanup?

`PipelineState` contains 5 dynamic arrays. Without cleanup, each market would permanently consume ~15 storage slots even after resolution. `_cleanupPipeline()` deletes all transient pipeline data when the pipeline reaches `Phase.Done`, keeping long-term storage costs bounded to the `Market` struct fields only.

### Why Confidence Threshold?

Resolution uses a configurable confidence threshold (default 70/100). If the LLM is uncertain about the outcome — ambiguous data, conflicting sources, insufficient tool results — it returns a confidence below the threshold. The market is rejected back to `Active` for retry instead of resolving incorrectly. This is the on-chain equivalent of a "I'm not sure" response.