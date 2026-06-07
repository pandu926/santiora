# Smart Contracts

Complete reference for all Santiora V5 contracts on Somnia Testnet.

## Contract Architecture

```
SantioraReactiveV5 (Scheduler)
    │
    │  _onEvent() fires at block intervals
    │
    ├── calls → SantioraV5.createMarket(category)        [round-robin categories]
    └── calls → SantioraV5.resolveMarket(marketId)       [expired markets]
                    │
                    ├── inherits → V5Pipeline (yield & resume state machine)
                    │        │
                    │        ├── uses → V5ToolRouter (route LLM calldata → real APIs)
                    │        └── calls → Agent Platform
                    │                    ├── LLM Agent (12847293847561029384)
                    │                    └── JSON API Agent (13174292974160097713)
                    │
                    ├── calls → V5Prompts (external prompt builder)
                    ├── uses → V5Helpers (JSON parsing, string utils)
                    ├── registers → IV5Registry (duplicate check + market index)
                    └── reads → V5Types (structs, enums, constants, events)
```

## Module Map

| File | Purpose | Lines |
|------|---------|-------|
| `V5Types.sol` | Constants, enums, structs, events, interfaces | ~130 |
| `V5Helpers.sol` | JSON parsing, string utilities, date formatting | ~195 |
| `V5ToolRouter.sol` | Maps LLM tool calldata to real API endpoints | ~140 |
| `V5Prompts.sol` | External prompt builder (reduce main contract size) | ~60 |
| `V5Pipeline.sol` | Abstract yield-and-resume state machine | ~370 |
| `SantioraV5.sol` | Main contract: market lifecycle, access control, finalization | ~370 |
| `SantioraReactiveV5.sol` | Block-based scheduler using `scheduleSubscriptionAtBlock` | ~230 |

## Deployment Addresses

| Contract | Address | Status |
|----------|---------|--------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` | Active |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` | Active |
| SantioraReactiveV5 | Not yet deployed | Pending |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Active |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Active |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia System |
| LLM Agent ID | `12847293847561029384` | Somnia System |
| JSON API Agent ID | `13174292974160097713` | Somnia System |

## SantioraV5

**Address:** `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B`

Main contract handling the full prediction market lifecycle. Inherits `V5Pipeline` for the yield-and-resume state machine. Implements market creation, resolution, JSON response parsing, duplicate detection, and registry integration.

### ABI (Key Functions)

```json
[
  {
    "type": "function",
    "name": "createMarket",
    "inputs": [{ "name": "category", "type": "string" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveMarket",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "forceResolve",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "markets",
    "inputs": [{ "name": "", "type": "uint256" }],
    "outputs": [
      { "name": "question", "type": "string" },
      { "name": "odds", "type": "uint256" },
      { "name": "deadline", "type": "uint256" },
      { "name": "category", "type": "string" },
      { "name": "status", "type": "uint8" },
      { "name": "outcome", "type": "string" },
      { "name": "confidence", "type": "uint256" },
      { "name": "createdAt", "type": "uint256" },
      { "name": "sourceUrl", "type": "string" },
      { "name": "rawResponse", "type": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "marketCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStats",
    "inputs": [],
    "outputs": [
      { "name": "totalCreated", "type": "uint256" },
      { "name": "totalResolved", "type": "uint256" },
      { "name": "totalFailed", "type": "uint256" },
      { "name": "totalRejected", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCategories",
    "inputs": [],
    "outputs": [{ "type": "string[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPipeline",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [
      { "name": "phase", "type": "uint8" },
      { "name": "iteration", "type": "uint8" },
      { "name": "totalPending", "type": "uint8" },
      { "name": "completed", "type": "uint8" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateRules",
    "inputs": [{ "name": "newRules", "type": "tuple", "components": [
      { "name": "balanceMinimum", "type": "uint256" },
      { "name": "confidenceThreshold", "type": "uint256" }
    ]}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setReactiveContract",
    "inputs": [{ "name": "reactive", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCategories",
    "inputs": [{ "name": "newCategories", "type": "string[]" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRegistry",
    "inputs": [{ "name": "registryAddr", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [{ "name": "newOwner", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getDeposit",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  }
]
```

### Constructor

```solidity
constructor(address registryAddr, address promptsAddr)
```

- `registryAddr`: Optional market registry for duplicate detection. Pass `address(0)` to disable.
- `promptsAddr`: Required external prompt contract. Must be non-zero.

Initializes default rules (`balanceMinimum: 1 STT`, `confidenceThreshold: 70`) and categories (`sports, crypto, finance, technology`).

### Access Control

| Modifier | Who | Purpose |
|----------|-----|---------|
| `onlyOwner` | Contract owner | Admin: rules, categories, registry, reactive, withdraw, forceResolve |
| `onlyAuthorized` | Owner or ReactiveV5 | Market operations: createMarket, resolveMarket |

### Market Listing

```solidity
Markets markets(uint256 marketId)
```

Returns the full market struct:

```solidity
struct Market {
    string question;     // Market question text (max 600 chars)
    uint256 odds;        // YES probability 1-99
    uint256 deadline;    // Unix timestamp for resolution eligibility
    string category;     // One of the supported categories
    MarketStatus status; // Creating(0), Active(1), Resolving(2), Resolved(3), Failed(4)
    string outcome;      // "YES" or "NO" after resolution
    uint256 confidence;  // LLM confidence 0-100
    uint256 createdAt;   // Block timestamp of creation
    string sourceUrl;    // URL of data source used
    string rawResponse;  // Complete LLM final response for audit
}
```

### Performance Stats

```solidity
struct Performance {
    uint256 totalCreated;   // Markets that reached Active status
    uint256 totalResolved;  // Markets that reached Resolved status
    uint256 totalFailed;    // Markets that reached Failed status
    uint256 totalRejected;  // Markets rejected (low confidence, duplicate, unparsable)
}
```

### Constructor and Initial State

Default categories: `["sports", "crypto", "finance", "technology"]`.
Default rules: `balanceMinimum = 1 ether`, `confidenceThreshold = 70`.

## V5Prompts

**Address:** `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7`

External prompt builder deployed separately to keep the main SantioraV5 contract under the size limit. Called by SantioraV5 before each `inferToolsChat` dispatch.

### Functions

```solidity
function createMarketPrompt(
    string calldata category,
    string calldata date
) external pure returns (string memory);

function resolveMarketPrompt(
    string calldata question,
    string calldata date,
    string calldata category,
    string calldata sourceUrl,
    string calldata odds,
    string calldata deadline
) external pure returns (string memory);
```

Both functions are `pure` -- they construct prompt strings at call time using inline `abi.encodePacked`. No state, no storage.

### Create Market Prompt Template

```
You are an autonomous prediction market creator on Somnia blockchain.
Today is {date}. Category: {category}.

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

OUTPUT: {"question":"...","deadline":"YYYY-MM-DD","odds":1-99,"category":"...","reasoning":"...","source_url":"..."}
```

### Resolve Market Prompt Template

```
You are an autonomous prediction market resolver on Somnia blockchain.
Today is {date}. You must determine the outcome of an existing market.

MARKET DETAILS:
- Question: "{question}"
- Category: {category}
- Original odds: {odds}%
- Deadline: {deadline}
- Original data source: {sourceUrl}

YOUR JOB:
1. ALWAYS fetch current data using tools FIRST
2. Compare the fetched value against the threshold in the question
3. Determine YES (event happened) or NO (event did not happen)

RULES:
- You MUST fetch real data - never guess the outcome
- Compare the CURRENT fetched value against the question threshold
- If current value > threshold in question, outcome is YES
- If current value <= threshold, outcome is NO
- Confidence 80-100 if data is clear, 50-79 if ambiguous

OUTPUT: {"outcome":"YES or NO","confidence":50-100,"reasoning":"...","evidence":"fetched value: X","source_url":"..."}
```

## V5Pipeline

Abstract contract inherited by SantioraV5. Implements the full `inferToolsChat` yield-and-resume state machine. See the [AI Agents](./ai-agents.md) document for the detailed flow.

### Key Functions

```solidity
// Start or resume an inferToolsChat session
function _dispatchInferToolsChat(
    uint256 marketId,
    string[] memory roles,
    string[] memory messages,
    bool isResolve
) internal;

// Callback from platform after LLM response
function onOrchestrateResult(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory
) external;

// Callback from platform after JSON agent fetch
function onToolResult(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory
) external;

// View pipeline state
function getPipeline(uint256 marketId) external view returns (
    uint8 phase, uint8 iteration, uint8 totalPending, uint8 completed
);

// View deposit amount
function getDeposit() public view returns (uint256);
```

### Abstract Hooks (implemented by SantioraV5)

```solidity
function _onFinalResponse(uint256 marketId, string memory response) internal virtual;
function _onPipelineFailed(uint256 marketId, string memory reason) internal virtual;
```

### Callback Guards

- `msg.sender == PLATFORM_ADDR` enforced on both `onOrchestrateResult` and `onToolResult`
- `_requestConsumed` mapping prevents duplicate callback processing (idempotency guard)

### Pipeline State (transient, deleted after Done)

```solidity
struct PipelineState {
    Phase phase;
    uint8 iteration;
    uint8 totalPendingTools;
    uint8 completedTools;
    bool isResolve;
    string[] savedRoles;
    string[] savedMessages;
    string[] toolCallIds;
    string[] toolResults;
    uint256[] toolRequestIds;
}
```

## V5ToolRouter

Pure library that decodes ABI-encoded tool calldata from the LLM and routes to real-world API endpoints. No state, no external calls -- only string construction.

### Tool Selector → API Mapping

| 4-byte Selector | Function Signature | API |
|---|---|---|
| `keccak256("fetchPrice(string)")` | `fetchPrice(string symbol)` | CoinGecko |
| `keccak256("fetchSportsFixture(string)")` | `fetchSportsFixture(string league)` | TheSportsDB |
| `keccak256("fetchHeadline(string)")` | `fetchHeadline(string topic)` | GitHub |
| `keccak256("fetchJSON(string,string)")` | `fetchJSON(string url, string selector)` | Custom URL |

### CoinGecko ID Mappings

`_toCoinGeckoId()` maps common symbols/tickers to CoinGecko API IDs:

| Input | CoinGecko ID |
|-------|-------------|
| BTC, btc, bitcoin | `bitcoin` |
| ETH, eth, ethereum | `ethereum` |
| SOL, sol, solana | `solana` |
| ADA, ada, cardano | `cardano` |
| DOT, dot, polkadot | `polkadot` |
| AVAX, avax | `avalanche-2` |
| LINK, link | `chainlink` |
| DOGE, doge | `dogecoin` |
| XRP, xrp | `ripple` |
| BNB, bnb | `binancecoin` |
| (default) | `bitcoin` |

### League ID Mappings

`_toLeagueId()` maps league names to TheSportsDB league IDs:

| Input | League ID |
|-------|-----------|
| MLS, mls | `4346` |
| Premier League, EPL, epl | `4328` |
| La Liga, la liga | `4335` |
| Serie A, serie a | `4332` |
| Bundesliga, bundesliga | `4331` |
| Ligue 1, ligue 1 | `4334` |
| Brazilian Serie A, brasileirao | `4351` |
| Argentine Primera, argentina | `4406` |
| NBA, nba | `4387` |
| NFL, nfl | `4391` |
| (default) | `4346` |

### Core Function

```solidity
function routeToolCall(bytes memory calldata_) internal pure returns (
    string memory url,
    string memory selector
)
```

- Extracts 4-byte selector via assembly (`mload`)
- Strips selector from calldata to get ABI-encoded arguments
- Routes based on selector match to the appropriate API URL builder
- `fetchJSON` passes through URL and selector directly (fully generic)

## V5Helpers

Pure library providing gas-efficient on-chain utilities for JSON parsing, string operations, and date formatting.

### JSON Parsing

```solidity
// Extract string value by key from JSON
function jsonString(string memory json, string memory key) internal pure returns (string memory);

// Extract uint value by key from JSON
function jsonUint(string memory json, string memory key) internal pure returns (uint256);
```

Both functions scan for `"key":` patterns and extract the associated value. They do not handle nested objects -- only top-level keys.

- `jsonString` returns `""` if key not found
- `jsonUint` returns `0` if key not found
- Escaped quotes within strings are handled

### String Utilities

```solidity
function isYes(string memory value) internal pure returns (bool);
function equals(string memory a, string memory b) internal pure returns (bool);
function contains(string memory haystack, string memory needle) internal pure returns (bool);
function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256);
function truncate(string memory s, uint256 maxLen) internal pure returns (string memory);
```

- `isYes`: Checks for `"YES"`, `"yes"`, or `"Yes"` (case-sensitive variants)
- `contains`: Case-sensitive substring search. Used for UNRESOLVABLE detection and other keyword checks
- `bound`: Clamps values. Used for odds (1-99) and deadline days (1-7)
- `truncate`: Cuts strings to max byte length. Questions capped at `MAX_FIELD_LENGTH` (600)

### Date Formatting

```solidity
function toDateStr(uint256 timestamp) internal pure returns (string memory);
function deadlineDays(string memory json, uint256 currentTimestamp) internal pure returns (uint256);
function toString(uint256 value) internal pure returns (string memory);
```

- `toDateStr`: Pure Solidity timestamp-to-`"YYYY-MM-DD"` conversion (no epoch library needed). Uses the algorithmic Gregorian calendar formula.
- `deadlineDays`: Parses `"deadline"` field from LLM JSON, converts `"YYYY-MM-DD"` string to delta days from `currentTimestamp`, clamped to `[1, 7]`.
- `toString`: Decimal string conversion with no external dependencies.

## V5Types

Central type definitions shared across all V5 modules. Contains constants, enums, structs, events, and the registry interface.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PLATFORM_ADDR` | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Agent Platform proxy |
| `JSON_AGENT_ID` | `13174292974160097713` | JSON API agent |
| `LLM_AGENT_ID` | `12847293847561029384` | Qwen3-30B LLM agent |
| `SUBCOMMITTEE_SIZE` | `3` | Validators per agent request |
| `PER_AGENT_COST` | `0.07 STT` | Cost per validator per request |
| `MAX_ITERATIONS` | `3` | Max inferToolsChat loops |
| `MAX_TOOLS_PER_YIELD` | `5` | Max tools per LLM yield |
| `MIN_CONFIDENCE` | `70` | Default confidence threshold |
| `MAX_DEADLINE_DAYS` | `7` | Max days from creation to deadline |
| `MIN_DEADLINE_DAYS` | `1` | Min days from creation to deadline |
| `MAX_FIELD_LENGTH` | `600` | Max bytes for string fields |

### Enums

```solidity
enum MarketStatus { Creating, Active, Resolving, Resolved, Failed }
//                  0          1         2         3        4

enum Phase { Idle, Orchestrating, ExecutingTools, Resuming, Done }
//           0         1                2         3      4
```

### Structs

| Struct | Fields | Purpose |
|--------|--------|---------|
| `Market` | question, odds, deadline, category, status, outcome, confidence, createdAt, sourceUrl, rawResponse | Persistent market data |
| `PipelineState` | phase, iteration, totalPendingTools, completedTools, isResolve, savedRoles[], savedMessages[], toolCallIds[], toolResults[], toolRequestIds[] | Transient per-market pipeline |
| `Rules` | balanceMinimum, confidenceThreshold | Protocol configuration |
| `Performance` | totalCreated, totalResolved, totalFailed, totalRejected | Lifetime stats |

### Registry Interface

```solidity
interface IV5Registry {
    function registerMarket(address creator, string calldata question, uint256 odds, uint256 deadline, string calldata category) external returns (uint256);
    function updateMarket(address creator, uint256 registryId, uint8 status, string calldata outcome, uint256 confidence) external;
    function isDuplicate(string calldata question) external view returns (bool);
}
```

### Events

**Market lifecycle:**

| Event | Parameters | Emitted When |
|-------|-----------|-------------|
| `MarketCreating` | `marketId, category` | Market creation initiated |
| `MarketActive` | `marketId, question, odds, deadline` | Market successfully created and active |
| `MarketResolving` | `marketId` | Resolution process initiated |
| `MarketResolved` | `marketId, outcome, confidence` | Market successfully resolved |
| `MarketRejected` | `marketId, reason` | Market rejected (low confidence, duplicate, etc.) |
| `PipelineFailed` | `marketId, reason` | Unrecoverable pipeline error |

**Tool execution:**

| Event | Parameters | Emitted When |
|-------|-----------|-------------|
| `ToolYielded` | `marketId, iteration, toolCount` | LLM returned tool_calls |
| `ToolExecuted` | `marketId, toolCallId, result` | A single tool fetch completed |
| `ResumeTriggered` | `marketId, iteration` | Pipeline re-dispatching LLM with tool results |

**Admin:**

| Event | Parameters | Emitted When |
|-------|-----------|-------------|
| `OwnershipTransferred` | `previous, current` | Owner changed |
| `Withdrawn` | `to, amount` | ETH withdrawn |
| `RulesUpdated` | `balanceMinimum, confidenceThreshold` | Rules changed |
| `ReactiveContractSet` | `reactive` | Reactive address set |
| `RegistrySet` | `registry` | Registry address set |

## SantioraReactiveV5

**Address:** Not yet deployed (pending)

Block-based autonomous scheduler using `scheduleSubscriptionAtBlock`. Triggers market creation and resolution at configurable intervals. Deploys with:

```solidity
constructor(address _v5, uint64 _createInterval, uint64 _resolveInterval)
```

### Deployment Parameters

- `_v5`: SantioraV5 address (`0x6257d213a59f2278692baBB2eAB24Ddc0700B94B`)
- `_createInterval`: Blocks between market creation attempts (e.g., 300 for ~5 min)
- `_resolveInterval`: Blocks between resolution scans (e.g., 150 for ~2.5 min)

Default gas limits: 200,000,000 for both create and resolve.

### Key Functions

```solidity
function startCreateLoop() external onlyOwner;
function startResolveLoop() external onlyOwner;
function stopCreateLoop() external onlyOwner;
function stopResolveLoop() external onlyOwner;
function setIntervals(uint64 createInterval, uint64 resolveInterval) external onlyOwner;
function setGasLimits(uint64 create, uint64 resolve) external onlyOwner;
function setV5(address newV5) external onlyOwner;
function withdraw(uint256 amount) external onlyOwner;
function forceResetCreate() external onlyOwner;
function forceResetResolve() external onlyOwner;
function getStats() external view returns (...);
```

### Create Logic

On each create trigger:
1. Reads categories from `v5.getCategories()`
2. Selects next category via round-robin (`categoryIndex % categories.length`)
3. Calls `v5.createMarket(category)`
4. Emits `CreateFired` on success, `CreateSkipped` if revert

### Resolve Logic

On each resolve trigger:
1. Reads `v5.marketCount()`
2. Iterates markets (max 10 per tick)
3. For each market with `status == 1` (Active) and `block.timestamp >= deadline`:
   - Calls `v5.resolveMarket(i)`
   - Increments `totalAutoResolves` on success
4. Emits `ResolveFired(blockNumber, marketsChecked, marketsResolved)`

### Events

```solidity
event CreateFired(uint256 blockNumber, string category);
event CreateSkipped(uint256 blockNumber, string reason);
event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);
```

### Self-Scheduling Pattern

After each `_onEvent()` invocation, the contract unsets its subscription ID and immediately re-schedules a new subscription for `currentBlock + intervalBlocks`. This ensures continuous operation. If a subscription expires without firing (edge case), the loop stops gracefully.

## Supporting Contracts

### SUSD Token

**Address:** `0xB553c0003C3F0419abD358A2edD16191fC86ef90`

Standard ERC20 stablecoin used as betting collateral. Mintable via faucet for testing.

Gas note: SUSD `approve()` requires **5,000,000 gas** on Somnia (not the standard 50K). Always use high gas limits for ERC20 operations on Somnia.

### SantioraFaucet

**Address:** `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1`

Distributes test tokens. One claim per address per 24 hours.

```json
[
  {
    "type": "function",
    "name": "claim",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "canClaim",
    "inputs": [{ "name": "user", "type": "address" }],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view"
  }
]
```

**Claim amounts:** 0.1 STT + 1000 SUSD per claim.

## Compilation

```bash
cd contracts
npm install
npx hardhat compile
```

Compiler: Solidity 0.8.30, EVM target: Paris.

The V5 contracts are compiled as part of the `contracts/src/v5/` directory. The interface file `IAgentPlatform.sol` in `contracts/src/interfaces/` provides the platform and tool agent type definitions.

## Verification

Contracts can be verified on the Somnia explorer:

```bash
npx hardhat verify --network somnia 0x6257d213a59f2278692baBB2eAB24Ddc0700B94B <registryAddr> <promptsAddr>
npx hardhat verify --network somnia 0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7
```

## Contract Size Notes

V5 was designed with the Spurious Dragon contract size limit (24576 bytes, EIP-170) in mind:

- `V5Prompts.sol` is deployed separately to keep prompt strings out of the main contract
- `V5Types.sol` contains shared constants, structs, and events -- imported by all modules
- `V5Helpers.sol` is a library (deployed once, used via DELEGATECALL) for size efficiency
- `V5ToolRouter.sol` is a library for the same reason
- `V5Pipeline.sol` is an abstract contract inherited by SantioraV5 (no separate deployment)