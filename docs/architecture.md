# Architecture

## System Overview

Santiora operates as a three-layer autonomous system. Each layer communicates through on-chain function calls — no off-chain infrastructure required for core operations.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCHEDULING LAYER                          │
│                                                                  │
│  SantioraReactiveV2                                             │
│  ├── scheduleSubscriptionAtBlock(block + 4500)  → create loop   │
│  └── scheduleSubscriptionAtBlock(block + 4500)  → resolve loop  │
│                                                                  │
│  Fires: ~96 times/day | Cost: ~0.5 STT/day                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ _onEvent() callback
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BRAIN LAYER                              │
│                                                                  │
│  SantioraFinalV2                                                │
│  ├── createMarket(category)                                     │
│  │   └── inferToolsChat → LLM generates question + odds         │
│  ├── autoResolveExpired(marketId)                               │
│  │   ├── JSON API Agent → fetch real-world data                 │
│  │   ├── LLM Agent (Resolver) → interpret outcome              │
│  │   └── LLM Agent (Verifier) → independent cross-check        │
│  └── Callbacks: onBrainResult / onDataFetched / onVerifyResult  │
│                                                                  │
│  Cost: ~0.33 STT per agent call                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ registers market
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MARKET LAYER                              │
│                                                                  │
│  MarketRegistry          PredictionMarketSUSD                   │
│  ├── getMarket(id)       ├── buyYes(amount)                     │
│  ├── getMarketCount()    ├── buyNo(amount)                      │
│  └── getActiveCount()    ├── claimWinnings()                    │
│                          └── ShareToken (YES/NO ERC20)          │
│                                                                  │
│  Users interact here: bet, claim, view positions                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Market Creation

```
Block N fires (scheduled)
    │
    ▼
ReactiveV2._onEvent()
    │
    ├── _handleCreate()
    │       │
    │       ├── finalV2.canCreateMarket() → (true, "ready")
    │       ├── finalV2.getNextCategory() → "technology"
    │       └── finalV2.createMarket("technology")
    │               │
    │               ├── Build system prompt + user prompt
    │               ├── createRequest(LLM_AGENT_ID, messages, callback)
    │               │       │
    │               │       ▼ (async — Agent Platform executes)
    │               │   Qwen3-30B generates:
    │               │   {
    │               │     "question": "Will Apple announce...",
    │               │     "odds": 65,
    │               │     "deadline": 1717200000,
    │               │     "category": "technology"
    │               │   }
    │               │       │
    │               │       ▼
    │               └── onBrainResult(requestId, response)
    │                       │
    │                       ├── Parse JSON response
    │                       ├── Register in MarketRegistry
    │                       └── Emit MarketCreated event
    │
    └── _scheduleAt(block + 4500) → re-schedule next fire
```

## Data Flow: Market Resolution (Agent-to-Agent)

```
Block M fires (scheduled)
    │
    ▼
ReactiveV2._onEvent()
    │
    ├── _handleResolve()
    │       │
    │       └── Loop through markets where deadline < now
    │               │
    │               ▼
    │       finalV2.autoResolveExpired(marketId)
    │               │
    │               ▼ Step 1: Fetch real-world data
    │       createRequest(JSON_API_AGENT, url, selector)
    │               │
    │               ▼ callback: onDataFetched()
    │               │
    │               ▼ Step 2: LLM Resolver interprets
    │       createRequest(LLM_AGENT, "Based on data, determine YES/NO...")
    │               │
    │               ▼ callback: onBrainResolveResult()
    │               │
    │               ▼ Step 3: LLM Verifier cross-checks
    │       createRequest(LLM_AGENT, "Independently verify...")
    │               │
    │               ▼ callback: onVerifyResult()
    │               │
    │               ├── Compare: Resolver says YES, Verifier says YES
    │               │   → confidence = 95%, resolve market
    │               │
    │               └── Mismatch: Resolver YES, Verifier NO
    │                   → confidence = 60%, mark failed or retry
    │
    └── _scheduleAt(block + 4500) → re-schedule next fire
```

## Component Responsibilities

### SantioraReactiveV2

**Role:** Autonomous scheduler. Zero logic beyond "fire at the right time."

- Uses `scheduleSubscriptionAtBlock` (one-shot triggers)
- Each callback re-schedules the next one
- Two independent loops: create and resolve
- Admin can adjust intervals without redeployment
- Gas-efficient: only pays when actual work happens

### SantioraFinalV2

**Role:** AI brain. Decides what markets to create and how to resolve them.

- Manages market lifecycle (Created → Active → Resolving → Resolved → Settled)
- Calls `inferToolsChat` on Somnia Agent Platform
- Implements agent-to-agent verification (Resolver + Verifier)
- Enforces rules: daily limits, cooldowns, confidence thresholds
- Stores resolution data on-chain for transparency

### MarketRegistry

**Role:** On-chain index of all markets across all versions.

- Single source of truth for market discovery
- Tracks active/resolved counts
- Frontend reads from here for market listings

### PredictionMarketSUSD

**Role:** Individual market instance. Handles betting mechanics.

- ERC20 share tokens (YES/NO)
- SUSD collateral
- Automated payout calculation on resolution
- `claimWinnings()` for winners after settlement

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
│  MetaMask    │                          │   Executes LLM calls │
└──────────────┘                          └──────────────────────┘
```

## Key Design Decisions

### Why scheduleSubscriptionAtBlock over BlockTick?

| Approach | Callbacks/day | Cost/day | Sustainability |
|----------|--------------|----------|----------------|
| BlockTick (every block) | 216,000 | ~112 STT | 40 STT lasts 9 hours |
| scheduleSubscriptionAtBlock | 96 | ~0.5 STT | 40 STT lasts 80+ days |

BlockTick fires every 400ms block regardless of whether work is needed. `scheduleSubscriptionAtBlock` fires exactly when scheduled — zero idle gas.

### Why Agent-to-Agent Verification?

Single-agent resolution is a single point of failure. If the LLM hallucinates, the market resolves incorrectly. The verification chain:

1. **JSON API Agent** fetches objective data (removes LLM from data gathering)
2. **LLM Resolver** interprets the data with one prompt
3. **LLM Verifier** independently interprets with a different prompt

If both agree → 95% confidence. If they disagree → lower confidence or retry. This catches hallucinations and prompt-sensitivity issues.

### Why On-Chain AI (not off-chain oracles)?

- **Verifiable:** Every agent call is a transaction with input/output on-chain
- **Trustless:** No centralized API server that can be shut down
- **Autonomous:** No cron job server to maintain
- **Composable:** Other contracts can call the same agents
- **Somnia-native:** Uses primitives impossible on other chains
