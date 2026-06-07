# Reactivity System

Santiora's autonomous operation relies on Somnia Native Reactivity -- a chain-level feature that triggers contract callbacks at specific blocks without external cron jobs, keepers, or off-chain infrastructure.

## Overview

| Approach | Requires | Cost Model | Reliability |
|----------|----------|------------|-------------|
| Chainlink Keepers | Off-chain network | Per-execution fee | Dependent on keeper network |
| Gelato | Off-chain relayer | Subscription | Dependent on relayer |
| Custom cron server | Server infrastructure | Server + gas | Single point of failure |
| **Somnia Reactivity** | **Nothing** | **Gas only when firing** | **Validator-guaranteed** |

Somnia Reactivity is built into the validator set. When a subscription fires, validators include the callback transaction in the block. No external infrastructure needed.

## scheduleSubscriptionAtBlock

The core primitive Santiora uses. Creates a one-shot subscription that fires at a specific future block.

### Function Signature

```solidity
function scheduleSubscriptionAtBlock(
    address handler,        // Contract that receives the callback
    uint64 blockNumber,     // Target block to fire at
    SubscriptionOptions memory options
) internal returns (uint256 subscriptionId);
```

### SubscriptionOptions

```solidity
struct SubscriptionOptions {
    uint64 priorityFeePerGas;  // Extra fee for validator priority
    uint64 maxFeePerGas;       // Maximum total fee per gas
    uint64 gasLimit;           // Gas budget for the callback
}
```

### How It Works

```
Block 100: Contract calls scheduleSubscriptionAtBlock(self, 200, opts)
            -> Subscription created, ID returned
            -> Validators note: "fire callback at block 200"

Block 101-199: Nothing happens. Zero gas consumed.

Block 200: Validator includes callback transaction
            -> Contract._onEvent() executes
            -> Contract schedules next: scheduleSubscriptionAtBlock(self, 300, opts)

Block 201-299: Nothing happens. Zero gas consumed.

Block 300: Cycle repeats.
```

### Key Properties

- **One-shot:** Each subscription fires exactly once, then is consumed.
- **Self-perpetuating:** The callback can schedule the next subscription, creating an infinite loop.
- **Cost:** Gas is only consumed when the subscription fires and re-schedules. No idle cost.
- **Minimum balance:** Contract must hold enough STT to cover gas for subscription creation and callback execution.

## SantioraReactiveV5

SantioraReactiveV5 inherits `SomniaEventHandler` and implements the block-based scheduling pattern for the V5 protocol.

### Contract Structure

```solidity
contract SantioraReactiveV5 is SomniaEventHandler {
    uint64 public createIntervalBlocks;   // e.g. 300 blocks between create fires
    uint64 public resolveIntervalBlocks;  // e.g. 600 blocks between resolve fires

    uint256 public createSubscriptionId;
    uint256 public resolveSubscriptionId;

    uint256 public lastCreateBlock;
    uint256 public lastResolveBlock;
}
```

### Two Independent Loops

SantioraReactiveV5 runs two self-perpetuating loops controlled by the owner:

**Create Loop** -- triggers AI market creation every N blocks:

```
startCreateLoop()
    -> scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    -> fires -> _onEvent() -> _handleCreate() -> scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    -> fires -> _onEvent() -> _handleCreate() -> scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    -> ... forever
```

**Resolve Loop** -- checks for expired markets every N blocks:

```
startResolveLoop()
    -> scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    -> fires -> _onEvent() -> _handleResolve() -> scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    -> fires -> _onEvent() -> _handleResolve() -> scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    -> ... forever
```

### Callback Handler

The `_onEvent` callback is invoked by the Somnia validator when a subscription fires:

```solidity
function _onEvent(
    address,
    bytes32[] calldata,
    bytes calldata
) internal override {
    uint256 currentBlock = block.number;

    if (currentBlock >= lastCreateBlock + createIntervalBlocks) {
        _handleCreate();
        createSubscriptionId = SomniaExtensions.scheduleSubscriptionAtBlock(
            address(this),
            uint64(currentBlock + createIntervalBlocks),
            _subscriptionOptions(gasLimitCreate)
        );
        lastCreateBlock = currentBlock;
    }

    if (currentBlock >= lastResolveBlock + resolveIntervalBlocks) {
        _handleResolve();
        resolveSubscriptionId = SomniaExtensions.scheduleSubscriptionAtBlock(
            address(this),
            uint64(currentBlock + resolveIntervalBlocks),
            _subscriptionOptions(gasLimitResolve)
        );
        lastResolveBlock = currentBlock;
    }
}
```

Each callback handles the relevant job (create or resolve, or both if intervals align), then immediately re-schedules the next fire. This is what makes the loop self-perpetuating.

### Category Rotation

The create loop rotates through four categories to ensure diverse market coverage. Each time `_handleCreate()` fires, the system advances to the next category:

```
sports -> crypto -> finance -> technology -> sports -> ...
```

The current category is tracked on-chain. When the create handler fires, SantioraReactiveV5 calls SantioraV5 to generate a market in the current category via the Agent Platform's LLM (Agent ID `12847293847561029384`).

If market creation cannot proceed (e.g. insufficient funds, rate limit, LLM unavailable), the loop fires a `CreateSkipped` event with the reason and continues to the next cycle. The loop never stalls permanently.

### Auto-Resolve Logic

The resolve loop scans for markets that need resolution. A market is eligible for auto-resolution when:

- `status == 1` (active/open)
- `block.timestamp >= deadline` (past its expiration)

When `_handleResolve()` fires, SantioraReactiveV5 calls SantioraV5 to resolve any expired markets. SantioraV5 uses the Agent Platform's JSON API agent (Agent ID `13174292974160097713`) to fetch and verify real-world event data, then records the outcome on-chain.

### Events

```solidity
event CreateFired(uint256 blockNumber, uint256 timestamp, string category);
event CreateSkipped(uint256 blockNumber, string reason);
event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);
```

## Gas Economics

Actual gas costs depend on block times, network congestion, and agent inference complexity. Key variables:

- **Create cost per market:** Agent calls consume STT for LLM inference. Each market creation costs approximately 0.72 STT through the Agent Platform.
- **Resolve cost:** Scanning for expired markets and fetching resolution data has lower gas overhead than creation.
- **Subscription creation:** Each `scheduleSubscriptionAtBlock` call incurs gas for the precompile interaction, typically around 210K gas.

Fund SantioraReactiveV5 with enough STT to cover many cycles. Fund SantioraV5 with at least 1 STT (each market costs approximately 0.72 STT in agent fees). Monitor balances and top up before they run out.

## Configuration

### Starting and Stopping

```solidity
// Owner starts the autonomous loops
function startCreateLoop() external onlyOwner;
function startResolveLoop() external onlyOwner;

// Owner stops loops (unsubscribes from validator)
function stopCreateLoop() external onlyOwner;
function stopResolveLoop() external onlyOwner;
```

### Adjusting Intervals

```solidity
function setCreateInterval(uint64 _blocks) external onlyOwner;
function setResolveInterval(uint64 _blocks) external onlyOwner;
```

Common configurations (assuming ~3 second block time on Somnia):

| Use Case | Create Interval | Resolve Interval | Approx. Creates/Day |
|----------|----------------|------------------|---------------------|
| Demo (fast) | 100 (~5 min) | 200 (~10 min) | ~288 |
| Balanced | 300 (~15 min) | 600 (~30 min) | ~96 |
| Production | 600 (~30 min) | 1200 (~1 hr) | ~48 |
| Conservative | 1200 (~1 hr) | 2400 (~2 hr) | ~24 |

### Gas Limit Tuning

```solidity
function setGasLimits(uint64 _create, uint64 _resolve) external onlyOwner;
```

- `gasLimitCreate`: Must cover the full SantioraV5 market creation path including agent inference. Set higher if callbacks revert during creation.
- `gasLimitResolve`: Must cover scanning markets and processing resolutions. Usually lower than create.

## Monitoring Loop Health

### On-Chain Stats

SantioraReactiveV5 exposes stats for monitoring:

```solidity
function getStats() external view returns (
    uint256 createFires,
    uint256 resolveFires,
    uint256 autoResolves,
    uint256 marketsCreated,
    uint256 lastCreateBlock,
    uint256 lastResolveBlock
);
```

### Verifying Loops Are Alive

```javascript
const stats = await publicClient.readContract({
  address: REACTIVE_V5,
  abi: reactiveV5Abi,
  functionName: "getStats",
});

const [createFires, resolveFires, , , lastCreate, lastResolve] = stats;
const currentBlock = await publicClient.getBlockNumber();

// A loop is considered alive if it fired within 2x its interval
const createAlive = (currentBlock - lastCreate) < createInterval * 2n;
const resolveAlive = (currentBlock - lastResolve) < resolveInterval * 2n;
```

### Subscription ID Check

```javascript
const createSubId = await publicClient.readContract({
  address: REACTIVE_V5,
  abi: reactiveV5Abi,
  functionName: "createSubscriptionId",
});

if (createSubId === 0n) {
  // Create loop is dead -- restart it
  console.warn("Create loop is not active. Call startCreateLoop() to restart.");
}
```

A subscription ID of 0 means the loop is not running. This can happen if the loop was stopped manually, or if a callback reverted and failed to re-schedule.

## Troubleshooting

### Loop Stopped Firing

1. **Check contract balance:** Insufficient STT prevents subscription creation. Top up if needed.
2. **Check subscription IDs:** If either ID is 0, the loop was stopped or failed to re-schedule.
3. **Check gas limits:** If a callback reverts (out of gas), the subscription is consumed but the re-schedule never executes.

```javascript
const createSubId = await readContract({ functionName: "createSubscriptionId" });
const resolveSubId = await readContract({ functionName: "resolveSubscriptionId" });

if (createSubId === 0n) {
  await writeContract({ functionName: "startCreateLoop", gas: 5_000_000n });
}
if (resolveSubId === 0n) {
  await writeContract({ functionName: "startResolveLoop", gas: 5_000_000n });
}
```

### Callback Reverts

If a callback reverts, the subscription is consumed (gas paid) but the loop breaks because `scheduleSubscriptionAtBlock` never executes. Common causes:

- SantioraV5 out of STT (cannot pay for agent inference calls)
- Agent Platform is rate-limiting or unavailable
- Gas limit too low for the full execution chain
- Market creation or resolution logic hitting an unexpected state

**Fix:** Resolve the underlying issue, then restart the affected loop.

### Balance Drops Below Minimum

Monitor balances proactively. If SantioraV5 balance drops below 1 STT, new market creation will fail. If SantioraReactiveV5 balance drops below what is needed for subscription creation, loop rescheduling will fail.

Set up balance monitoring:

```javascript
const v5Balance = await client.getBalance({ address: SANTIORA_V5 });
const reactiveBalance = await client.getBalance({ address: REACTIVE_V5 });

if (Number(formatEther(v5Balance)) < 1) {
  console.warn("WARNING: SantioraV5 balance below 1 STT. Market creation will fail.");
}
if (Number(formatEther(reactiveBalance)) < 2) {
  console.warn("WARNING: SantioraReactiveV5 balance low. Loop may fail to re-schedule.");
}
```

## Comparison: BlockTick vs scheduleSubscriptionAtBlock

### BlockTick (Legacy Approach)

```solidity
// Subscribes to EVERY block -- thousands of callbacks per day
bytes32 blockTickSig = keccak256("BlockTick(uint64)");
PRECOMPILE.subscribe(subData);

function _onEvent(...) {
    // Called every single block
    if (block.number % 300 == 0) {
        // Only do work on specific blocks
        // But PAY GAS for every callback
    }
}
```

**Problem:** You pay gas for thousands of no-op callbacks to get a handful of useful ones.

### scheduleSubscriptionAtBlock (V5 Approach)

```solidity
// Schedule exactly when needed
SomniaExtensions.scheduleSubscriptionAtBlock(self, block + 300, opts);

function _onEvent(...) {
    // Called exactly when scheduled -- ALWAYS does useful work
    _handleCreate();
    // Re-schedule next
    SomniaExtensions.scheduleSubscriptionAtBlock(self, block + 300, opts);
}
```

**Result:** Orders-of-magnitude fewer callbacks. Zero idle gas. Same functionality. Every callback produces market activity or resolution.