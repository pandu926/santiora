# AI Agents

Santiora V5 uses Somnia's native Agent Platform to execute AI reasoning on-chain. The key architectural shift from V4 to V5 is the **yield and resume** pattern -- instead of calling agents separately and stitching callbacks together, the LLM itself decides what data to fetch, the contract executes those tool calls, and the conversation resumes with results appended.

Every agent call is a transaction. Inputs, outputs, and costs are fully verifiable on the Somnia block explorer.

## Agent Platform

The Somnia Agent Platform (`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`) is a predeployed proxy contract that routes requests to registered AI agents. Each agent has a unique numeric ID and executes specific capabilities.

### Registered Agents

| Agent ID | Type | Capability |
|----------|------|------------|
| `12847293847561029384` | LLM Inference | General-purpose text generation (Qwen3-30B) |
| `13174292974160097713` | JSON API Request | HTTP fetch with JSON path extraction |

## Core Pattern: inferToolsChat with Yield and Resume

This is the signature V5 innovation. Instead of the V2-V4 approach of calling agents sequentially and wiring callbacks by hand, V5 uses the `inferToolsChat` interface which supports **multi-turn tool use in a single call**.

### How it works at a high level

```
1. DISPATCH: Contract sends system + user messages + tool definitions to LLM
2. YIELD:   LLM returns finishReason="tool_calls" + ABI-encoded calldata
3. EXECUTE: Contract routes each tool call to the JSON API agent
4. RESUME:  Contract appends tool results as role="tool" messages, re-dispatches
5. STOP:    LLM returns finishReason="stop" with final JSON output
```

### The OnchainTool Format Discovery (Critical V5 Bug Fix)

In V4, tools were passed as JSON schemas. All tool calls failed silently because the Agent Platform's `OnchainTool` struct does **not** accept JSON schema. It uses a much simpler format:

```solidity
struct OnchainTool {
    string a;  // Solidity function signature
    string b;  // Plain-language description
}
```

This discovery was the breakthrough. The fields are:

- **`a`**: A Solidity function signature string, e.g. `"fetchPrice(string symbol)"`. The 4-byte selector is derived from `keccak256` of this string.
- **`b`**: A plain English description, e.g. `"Fetch current USD price of a cryptocurrency (e.g. BTC, ETH, SOL)"`.

The LLM, seeing these function signatures, generates ABI-encoded calldata (4-byte selector + encoded arguments). The contract decodes the selector, routes to the corresponding real-world API, executes the fetch, and appends results.

### The Four Tools

```solidity
tools[0] = OnchainTool(
    "fetchPrice(string symbol)",
    "Fetch current USD price of a cryptocurrency (e.g. BTC, ETH, SOL, DOGE, XRP)"
);
tools[1] = OnchainTool(
    "fetchSportsFixture(string league)",
    "Fetch next upcoming fixture for a sports league (e.g. MLS, EPL, La Liga, NBA, NFL)"
);
tools[2] = OnchainTool(
    "fetchHeadline(string topic)",
    "Fetch trending information about a topic from GitHub"
);
tools[3] = OnchainTool(
    "fetchJSON(string url, string selector)",
    "Fetch any JSON API and extract a value using dot-notation selector"
);
```

### inferToolsChat Interface

```solidity
function inferToolsChat(
    string[] memory roles,
    string[] memory messages,
    string[] memory mcpServerUrls,
    OnchainTool[] memory onchainTools,
    uint256 maxIterations,
    bool chainOfThought
) external returns (
    string memory finishReason,        // "stop" or "tool_calls"
    string memory response,            // Final text (when stop)
    string[] memory updatedRoles,      // Full conversation (when tool_calls)
    string[] memory updatedMessages,   // Full conversation (when tool_calls)
    string[] memory pendingToolCallIds,// Tool call identifiers
    bytes[] memory pendingToolCalls    // ABI-encoded calldata
);
```

Key parameters:
- **`maxIterations`**: Set to `3`. Each LLM yield + resume counts as one iteration. After 3 iterations the LLM must produce a final answer, or the pipeline fails.
- **`chainOfThought`**: Set to `true`, enabling reasoning traces.
- **`mcpServerUrls`**: Empty array -- V5 does not use MCP servers. All data fetching goes through the JSON API agent via tool routing.

## V5 Pipeline: Full State Machine

The pipeline is implemented in `V5Pipeline.sol` as an abstract contract inherited by `SantioraV5.sol`. It manages the full lifecycle of an `inferToolsChat` session.

### Phase Enum

```solidity
enum Phase {
    Idle,             // 0 — no pipeline active
    Orchestrating,    // 1 — LLM request dispatched
    ExecutingTools,   // 2 — LLM yielded, tools being executed
    Resuming,         // 3 — tools done, re-dispatching LLM with results
    Done              // 4 — final answer received
}
```

### Pipeline State Lifecycle

```
Idle
  │ _dispatchInferToolsChat()
  ▼
Orchestrating ───── onOrchestrateResult() ─────┐
  │                                              │
  │ finishReason="stop"                         │ finishReason="tool_calls"
  │ → _finalizePipeline()                        │ → _handleToolYield()
  ▼                                              ▼
Done                                        ExecutingTools
  │                                              │
  │                                              │ each tool dispatched → onToolResult()
  │                                              │ all tools done → _checkAllToolsDone()
  │                                              ▼
  │                                          Resuming
  │                                              │ _resumeOrchestration()
  │                                              │ re-dispatches inferToolsChat with results
  │                                              ▼
  │                                          Orchestrating (loop)
  │
  ▼
_onFinalResponse() → SantioraV5 parses JSON
```

### Yield and Resume in Detail

**Step 1: Dispatch** (`_dispatchInferToolsChat`)

The contract builds the full message array with V5Prompts and calls the platform:

```solidity
bytes memory payload = abi.encodeWithSelector(
    IToolsAgent.inferToolsChat.selector,
    roles, messages, mcpUrls, tools, MAX_ITERATIONS, true
);
uint256 reqId = _platform.createRequest{value: getDeposit()}(
    LLM_AGENT_ID, address(this), this.onOrchestrateResult.selector, payload
);
```

Subcommittee size: `3` validators per request. Per-agent cost: `0.07 STT`. Platform deposit: variable (queried at call time via `getRequestDeposit()`). Total deposit: `getRequestDeposit() + 3 * 0.07 STT`.

**Step 2: Orchestration Result** (`onOrchestrateResult`)

This is the single callback for ALL `inferToolsChat` results. It inspects `finishReason`:

- `"stop"` → LLM produced final answer. Call `_finalizePipeline()`, which invokes `_onFinalResponse()` (implemented by SantioraV5).
- `"tool_calls"` → LLM wants data. Call `_handleToolYield()`, which stores the conversation state and dispatches each tool.
- No tool calls + non-empty response → Treat as final answer (max_iterations edge case).
- No response → Fail with `_onPipelineFailed()`.

**Step 3: Tool Execution** (`routeAndDispatch`)

Each yielded tool call is routed through `V5ToolRouter.routeToolCall()`:

```solidity
(bytes memory url, string selector) = calldata_.routeToolCall();
```

The router decodes the 4-byte selector, extracts arguments, and maps to real API endpoints:

| Tool Selector | API Endpoint | Return |
|---|---|---|
| `fetchPrice(string)` | CoinGecko `/simple/price` | e.g. `bitcoin.usd` |
| `fetchSportsFixture(string)` | TheSportsDB `/eventsnextleague` | e.g. `events[0].strEvent` |
| `fetchHeadline(string)` | GitHub `/search/repositories` | e.g. `items[0].full_name` |
| `fetchJSON(string,string)` | Direct URL + JSON path | Raw value |

Each tool call becomes a separate `createRequest` to the JSON API agent with `fetchString`. The contract tracks completion count.

**Step 4: Tool Result** (`onToolResult`)

Each tool result is stored in `pipe.toolResults[toolIdx]`. When all tools complete (`completedTools == totalPendingTools`), `_checkAllToolsDone()` triggers resume.

**Step 5: Resume** (`_resumeOrchestration`)

The contract rebuilds the conversation array by appending `role="tool"` messages:

```solidity
for (uint256 i = 0; i < toolCount; i++) {
    roles[baseLen + i] = "tool";
    messages[baseLen + i] = string(abi.encodePacked(
        '{"tool_call_id":"', pipe.toolCallIds[i],
        '","content":"', pipe.toolResults[i], '"}'
    ));
}
```

Then re-dispatches `inferToolsChat` with the augmented conversation. Events `ToolYielded`, `ToolExecuted`, and `ResumeTriggered` log the full chain for on-chain verification.

### Error Handling in Pipeline

- **Orchestration failure**: If `ResponseStatus != Success` or empty responses, emit `PipelineFailed` and mark market as `Failed`.
- **Decode failure**: If the LLM response cannot be ABI-decoded, catch and fail.
- **Tool routing failure**: Individual tool failures produce `"ERROR: ..."` as the tool result, which the LLM sees on resume and can adapt to.
- **Tool decode failure**: If JSON agent response cannot be decoded from bytes to string, produce `"ERROR: decode failed"`.
- **Max iterations**: After 3 iterations, the LLM must produce a final answer. If it yields tools on iteration 3, the result is treated as final even if finishReason is `"tool_calls"`.
- **Request consumed guard**: A `_requestConsumed` mapping prevents duplicate callback processing.

## Market Creation Agent Flow

When ReactiveV5 triggers `createMarket("technology")`, SantioraV5:

1. Validates the category and minimum balance (`1 STT`)
2. Creates a new market entry with status `Creating`
3. Emits `MarketCreating`
4. Builds system prompt via `V5Prompts.createMarketPrompt()`:
   ```
   You are an autonomous prediction market creator on Somnia blockchain.
   Today is 2026-06-03. Category: technology.

   RULES:
   - Markets must be about verifiable real-world events
   - Deadline must be 1-7 days from today
   - Odds must reflect genuine probability (NEVER default to 50)
   - Use tools to get REAL current data before creating a market
   - Be specific: include numbers, names, dates from fetched data

   WORKFLOW:
   1. Fetch relevant data using available tools
   2. Analyze the data for interesting prediction angles
   3. Create ONE specific, time-bound prediction market

   OUTPUT:
   {"question":"...","deadline":"YYYY-MM-DD","odds":1-99,"category":"...","reasoning":"...","source_url":"..."}
   ```
5. Dispatches `inferToolsChat` with the 4 tools
6. LLM fetches data (e.g., `fetchPrice("BTC")` → $87,432), creates a market
7. On final response, SantioraV5 parses: `question`, `odds`, `deadline`, `source_url`
8. Validates: question non-empty, odds bounded to `[1, 99]`, deadline `1-7` days
9. Checks for duplicates via `IV5Registry.isDuplicate()`
10. Sets status to `Active`, emits `MarketActive`

### Expected LLM Response (after tool fetch)

```json
{
  "question": "Will Bitcoin exceed $90,000 by June 10, 2026?",
  "deadline": "2026-06-10",
  "odds": 65,
  "category": "crypto",
  "reasoning": "BTC at $87,432. 7.1% gain needed in 7 days. Achievable given current momentum.",
  "source_url": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
}
```

### Duplicate Prevention

Before activating a market, SantioraV5 calls `registry.isDuplicate(question)` to prevent near-identical markets from being created multiple times. If the registry reports a duplicate, the market is rejected with reason `"duplicate market"` and status set to `Failed`.

## Market Resolution Agent Flow

When ReactiveV5 triggers `resolveMarket(marketId)` (or owner calls `forceResolve`), SantioraV5:

1. Verifies market exists and is `Active`
2. Checks `block.timestamp >= deadline` (skip for `forceResolve`)
3. Sets status to `Resolving`, emits `MarketResolving`
4. Builds system prompt via `V5Prompts.resolveMarketPrompt()` with full market context:
   - Question, category, original odds, deadline, source URL
5. Dispatches `inferToolsChat` with the same 4 tools
6. LLM fetches current data, compares against the question threshold, determines outcome
7. On final response, SantioraV5 parses: `outcome`, `confidence`

### Expected LLM Response (after tool fetch)

```json
{
  "outcome": "YES",
  "confidence": 92,
  "reasoning": "BTC price is $91,234, exceeding the $90,000 threshold.",
  "evidence": "fetched value: 91234",
  "source_url": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
}
```

### Resolution Acceptance Criteria

The contract applies three checks in order:

1. **UNRESOLVABLE check**: If the response contains `"UNRESOLVABLE"`, the market is **rejected** (stays `Active` for future retry). This handles cases where data sources are unavailable, API returns errors, or the LLM cannot determine a clear outcome.
2. **Empty outcome check**: If `outcome` is an empty string, the market is rejected.
3. **Confidence threshold**: If `confidence < 70`, the market is rejected. The threshold is stored in `rules.confidenceThreshold` and defaults to `MIN_CONFIDENCE` (70).

Only when all three pass does the market transition to `Resolved`:

```solidity
m.outcome = outcome;
m.confidence = confidence;
m.status = MarketStatus.Resolved;
performance.totalResolved++;
```

### What Happens on UNRESOLVABLE / Low Confidence

Markets that fail any of the three checks do **not** become `Failed`. They stay `Active` with an incremented `totalRejected` counter. This is an intentional design choice:

- The market remains open for betting (or past-deadline but unresolved)
- On the next `resolveInterval` tick, ReactiveV5 will attempt resolution again
- The LLM may fetch different data or arrive at a different conclusion
- This retry loop naturally handles transient API failures and temporary data ambiguity

Only pipeline-level failures (LLM request fails, decode errors, exhausted retries) set the market to `Failed`.

## Confidence Threshold

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_CONFIDENCE` | `70` | Default minimum confidence for resolution |
| `rules.confidenceThreshold` | `70` | Configurable via `updateRules()` |

The 70% threshold means the LLM must be reasonably certain before an outcome is accepted. This is lower than the V2 threshold of 80% -- the reduction reflects the improved data quality from tool-based fetching (the LLM now sees actual API data rather than relying on training knowledge).

## Agent Costs

Deposit calculation per `inferToolsChat` call:

```solidity
function getDeposit() public view returns (uint256) {
    return _platform.getRequestDeposit() + PER_AGENT_COST * SUBCOMMITTEE_SIZE;
}
// PER_AGENT_COST = 0.07 STT, SUBCOMMITTEE_SIZE = 3
```

| Operation | inferToolsChat calls | Tool fetches | Approximate Cost |
|-----------|---------------------|--------------|------------------|
| Create market (no tools) | 1 (stop on first call) | 0 | platform_deposit + 0.21 STT |
| Create market (1 tool yield) | 2 (yield + resume) | 1-4 JSON agent calls | 2x deposit + 0.21-0.84 STT |
| Create market (2 tool yields) | 3 (yield + resume + stop) | up to 8 JSON calls | 3x deposit + up to 1.68 STT |
| Resolve market (no tools) | 1 | 0 | platform_deposit + 0.21 STT |
| Resolve market (1 tool yield) | 2 | 1-4 JSON calls | 2x deposit + 0.21-0.84 STT |

Each JSON agent call (`fetchString`) also incurs the per-agent cost for its subcommittee. The exact `getRequestDeposit()` value is queried from the platform at call time and may vary.

### Daily Budget Planning

| Interval | Creates/Day | Resolves/Day | Estimated STT/Day |
|----------|-------------|--------------|-------------------|
| 30 min | 48 | 48 | ~16 (creates) + ~16 (resolves) |
| 1 hour | 24 | 48 | ~8 (creates) + ~16 (resolves) |
| 2 hours | 12 | 48 | ~4 (creates) + ~16 (resolves) |

## On-Chain Verification

Every agent interaction is verifiable on-chain:

1. **Request transaction**: Shows the encoded `inferToolsChat` payload sent to the agent
2. **Callback transaction**: Shows the agent's response delivered to `onOrchestrateResult`
3. **Tool events**: `ToolYielded` → multiple `ToolExecuted` → `ResumeTriggered` trace the full tool execution chain
4. **Final events**: `MarketActive` or `MarketResolved` confirms the outcome

Example explorer flow for a create market with one tool yield:

```
TX 1: ReactiveV5._onEvent() → SantioraV5.createMarket("crypto")
TX 2: SantioraV5 → Platform.createRequest(LLM_AGENT, inferToolsChat payload)
TX 3: Platform → SantioraV5.onOrchestrateResult(result)  [finishReason="tool_calls"]
      Events: ToolYielded(marketId, iteration=1, toolCount=1)
TX 4: SantioraV5 → Platform.createRequest(JSON_AGENT, fetchString payload)
TX 5: Platform → SantioraV5.onToolResult(result)  [BTC price data]
      Events: ToolExecuted(marketId, toolCallId, result)
TX 6: SantioraV5 → Platform.createRequest(LLM_AGENT, inferToolsChat with tool results)
      Events: ResumeTriggered(marketId, iteration=1)
TX 7: Platform → SantioraV5.onOrchestrateResult(result)  [finishReason="stop"]
      Events: MarketActive(marketId, question, odds, deadline)
```

All transactions are linked by `requestId` and `marketId`, visible on the Somnia explorer.

## Comparison: V2-V4 vs V5

| Aspect | V2-V4 | V5 |
|--------|-------|-----|
| Agent orchestration | Sequential agent calls with manual callback wiring | Single `inferToolsChat` with yield/resume |
| Data fetching | Hardcoded API URLs per category | LLM decides what to fetch via tools |
| Tool format | JSON schema (broken) | Solidity function signatures (fixed) |
| Resolution | 3-agent chain (resolver + verifier) | Single LLM with tool-fetched evidence |
| Confidence model | 2-agent agreement weighted average | Single LLM confidence with 70% threshold |
| Failed resolution | Market → Failed (terminal) | Market → stays Active (retryable) |
| Callback count | 3 separate callbacks per market | 1 callback + N tool callbacks |
| Code complexity | Callback chain in one contract | Modular pipeline/helpers/router split |