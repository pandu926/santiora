# Reactivity System

Santiora's autonomous operation relies on Somnia Native Reactivity — a chain-level feature that triggers contract callbacks at specific blocks without external cron jobs or keepers.

## Overview

Traditional approaches to periodic on-chain execution:

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
            → Subscription created, ID returned
            → Validators note: "fire callback at block 200"

Block 101-199: Nothing happens. Zero gas consumed.

Block 200: Validator includes callback transaction
            → Contract._onEvent() executes
            → Contract schedules next: scheduleSubscriptionAtBlock(self, 300, opts)

Block 201-299: Nothing happens. Zero gas consumed.

Block 300: Cycle repeats.
```

### Key Properties

- **One-shot:** Each subscription fires exactly once, then is consumed
- **Self-perpetuating:** The callback can schedule the next subscription
- **Minimum balance:** Contract must hold ≥ 32 STT (protocol requirement)
- **Gas limit:** Maximum 200,000,000 per callback (protocol cap)
- **Cost:** ~210K gas to create a subscription (~0.002 STT)

## SantioraReactiveV2 Implementation

### Contract Structure

```solidity
contract SantioraReactiveV2 is SomniaEventHandler {
    uint64 public createIntervalBlocks;   // 4500 blocks = ~30 min
    uint64 public resolveIntervalBlocks;  // 4500 blocks = ~30 min
    uint64 public gasLimitCreate;         // 20,000,000
    uint64 public gasLimitResolve;        // 10,000,000

    uint256 public createSubscriptionId;
    uint256 public resolveSubscriptionId;
}
```

### Two Independent Loops

ReactiveV2 runs two self-perpetuating loops:

**Create Loop** — triggers market creation every N blocks:
```
startCreateLoop()
    → scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    → fires → _handleCreate() → scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    → fires → _handleCreate() → scheduleSubscriptionAtBlock(block + createIntervalBlocks)
    → ... forever
```

**Resolve Loop** — checks for expired markets every N blocks:
```
startResolveLoop()
    → scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    → fires → _handleResolve() → scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    → fires → _handleResolve() → scheduleSubscriptionAtBlock(block + resolveIntervalBlocks)
    → ... forever
```

### Callback Handler

```solidity
function _onEvent(
    address,
    bytes32[] calldata,
    bytes calldata
) internal override {
    uint256 currentBlock = block.number;

    // Determine which job fired based on timing
    if (currentBlock >= lastCreateBlock + createIntervalBlocks) {
        _handleCreate();
        createSubscriptionId = _scheduleAt(currentBlock + createIntervalBlocks, gasLimitCreate);
        lastCreateBlock = currentBlock;
    }

    if (currentBlock >= lastResolveBlock + resolveIntervalBlocks) {
        _handleResolve();
        resolveSubscriptionId = _scheduleAt(currentBlock + resolveIntervalBlocks, gasLimitResolve);
        lastResolveBlock = currentBlock;
    }
}
```

### Internal Scheduling Helper

```solidity
function _scheduleAt(uint64 targetBlock, uint64 gasLimit) internal returns (uint256) {
    SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
        priorityFeePerGas: 2_000_000_000,   // 2 gwei priority
        maxFeePerGas: 10_000_000_000,        // 10 gwei max
        gasLimit: gasLimit
    });

    return SomniaExtensions.scheduleSubscriptionAtBlock(
        address(this),
        targetBlock,
        opts
    );
}
```

## Gas Economics

### Per-Fire Cost Breakdown

| Operation | Gas Used | Cost (STT) |
|-----------|----------|------------|
| Callback execution overhead | ~50,000 | 0.0005 |
| Subscription creation (re-schedule) | ~210,000 | 0.002 |
| _handleResolve (scan markets) | ~200,000 | 0.002 |
| _handleCreate (call FinalV2) | ~300,000 | 0.003 |
| **Total per fire** | **~500,000** | **~0.005** |

### Daily Cost at Default Intervals

| Loop | Interval | Fires/Day | Cost/Day |
|------|----------|-----------|----------|
| Create | 4500 blocks (~30 min) | 48 | 0.24 STT |
| Resolve | 4500 blocks (~30 min) | 48 | 0.24 STT |
| **Total** | | **96** | **~0.48 STT** |

### Sustainability

| Deposit | Duration |
|---------|----------|
| 40 STT | ~83 days |
| 100 STT | ~208 days |
| 32 STT (minimum) | ~66 days |

Note: FinalV2 agent calls cost additional ~0.33 STT each. With 48 creates/day, FinalV2 needs ~16 STT/day. Adjust `createIntervalBlocks` to control agent call frequency.

## Configuration

### Adjusting Intervals

```solidity
// Owner-only functions
function setCreateInterval(uint64 _blocks) external onlyOwner;
function setResolveInterval(uint64 _blocks) external onlyOwner;
```

Common configurations:

| Use Case | Create Interval | Resolve Interval | Fires/Day |
|----------|----------------|------------------|-----------|
| Demo (fast) | 750 (~5 min) | 750 (~5 min) | 576 |
| Production | 4500 (~30 min) | 4500 (~30 min) | 96 |
| Conservative | 9000 (~1 hr) | 4500 (~30 min) | 72 |
| Minimal | 21600 (~2.4 hr) | 9000 (~1 hr) | 34 |

### Stopping and Restarting

```solidity
// Stop loops (unsubscribes from validator)
function stopCreateLoop() external onlyOwner;
function stopResolveLoop() external onlyOwner;

// Restart (creates new subscription)
function startCreateLoop() external onlyOwner;
function startResolveLoop() external onlyOwner;
```

### Gas Limit Tuning

```solidity
function setGasLimits(uint64 _create, uint64 _resolve) external onlyOwner;
```

- `gasLimitCreate`: Must be high enough for FinalV2.createMarket → inferToolsChat chain. Recommended: 20,000,000.
- `gasLimitResolve`: Must cover market scanning + autoResolveExpired. Recommended: 10,000,000.

## Monitoring

### On-Chain Stats

```solidity
function getStats() external view returns (
    uint256 createFires,      // Total create loop executions
    uint256 resolveFires,     // Total resolve loop executions
    uint256 autoResolves,     // Markets successfully auto-resolved
    uint256 marketsCreated,   // Markets successfully created
    uint256 lastCreateBlock,  // Block of last create fire
    uint256 lastResolveBlock  // Block of last resolve fire
);
```

### Events

```solidity
event CreateFired(uint256 blockNumber, uint256 timestamp, string category);
event CreateSkipped(uint256 blockNumber, string reason);
event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);
```

### Verifying Loop Health

```javascript
const stats = await publicClient.readContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "getStats",
});

const [createFires, resolveFires, , , lastCreate, lastResolve] = stats;
const currentBlock = await publicClient.getBlockNumber();

// Check if loops are alive
const createAlive = (currentBlock - lastCreate) < createInterval * 2;
const resolveAlive = (currentBlock - lastResolve) < resolveInterval * 2;
```

## Comparison: BlockTick vs scheduleSubscriptionAtBlock

### BlockTick (Old Approach)

```solidity
// Subscribes to EVERY block — fires 216,000 times/day
bytes32 blockTickSig = keccak256("BlockTick(uint64)");
PRECOMPILE.subscribe(subData); // fires every 400ms

function _onEvent(...) {
    // Called every single block
    if (block.number % 4500 == 0) {
        // Only do work 48 times/day
        // But PAY GAS 216,000 times/day
    }
}
```

**Problem:** You pay gas for 216,000 no-op callbacks to get 48 useful ones.

### scheduleSubscriptionAtBlock (Current Approach)

```solidity
// Schedule exactly when needed — fires 96 times/day
SomniaExtensions.scheduleSubscriptionAtBlock(self, block + 4500, opts);

function _onEvent(...) {
    // Called exactly when scheduled
    // ALWAYS does useful work
    _handleCreate();
    // Re-schedule next
    scheduleSubscriptionAtBlock(self, block + 4500, opts);
}
```

**Result:** 3000x fewer callbacks. Zero idle gas. Same functionality.

## Troubleshooting

### Loop Stopped Firing

1. Check contract balance: must be ≥ 32 STT
2. Check subscription IDs: if 0, loop was stopped or failed to re-schedule
3. Check gas limit: if callback reverts, subscription is consumed but not re-scheduled

```javascript
const createSubId = await readContract({ functionName: "createSubscriptionId" });
if (createSubId === 0n) {
  // Loop is dead — restart it
  await writeContract({ functionName: "startCreateLoop", gas: 5_000_000n });
}
```

### Callback Reverts

If the callback reverts, the subscription is consumed (gas paid) but the loop breaks because `_scheduleAt` never executes. Common causes:

- FinalV2 out of STT (can't pay for agent calls)
- FinalV2 `canCreateMarket()` returns false and the try/catch doesn't cover all paths
- Gas limit too low for the full execution chain

Fix: Restart the loop after resolving the underlying issue.

### Balance Below Minimum

The 32 STT minimum is checked at subscription creation time. If balance drops below 32 STT between fires, the next `_scheduleAt` call will revert with `InsufficientBalance()`.

Monitor balance and top up before it drops below 35 STT.
