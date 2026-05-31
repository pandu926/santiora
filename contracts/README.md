# Santiora Contracts

Solidity smart contracts for the Santiora prediction market protocol on Somnia Agentic L1.

## Overview

Autonomous AI-operated prediction market system. Contracts handle market creation, betting, resolution, and scheduling — all triggered by on-chain AI agents without human intervention.

## Getting Started

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
```

## Project Structure

```
src/
├── agents/
│   ├── SantioraFinalV2.sol        # AI brain — creates/resolves markets via inferToolsChat
│   ├── SantioraReactiveV2.sol     # Autonomous scheduler (scheduleSubscriptionAtBlock)
│   ├── SantioraOrchestrator.sol   # Legacy orchestrator
│   ├── SantioraBrain.sol          # Legacy brain
│   ├── SantioraFinal.sol          # V1 brain (deprecated)
│   ├── SantioraReactive.sol       # V1 reactive (deprecated)
│   ├── MarketCreatorLLM.sol       # Standalone LLM market creator
│   ├── MarketCreatorV3Agent.sol   # V3 pipeline agent
│   ├── TestInferToolsChat.sol     # inferToolsChat test contract
│   └── TestBothMethods.sol        # Method comparison test
├── MarketRegistry.sol             # On-chain market index
├── PredictionMarketSUSD.sol       # Individual market (betting + settlement)
├── ShareToken.sol                 # YES/NO ERC20 share tokens
├── SUSD.sol                       # Stablecoin for betting
├── MarketFactoryLite.sol          # Market deployer
├── SantioraFaucet.sol             # Test token faucet
├── Treasury.sol                   # Fee collection
└── interfaces/
    └── IAgentPlatform.sol         # Somnia Agent Platform interface
```

## Core Contracts

### SantioraReactiveV2

Autonomous scheduler using Somnia's `scheduleSubscriptionAtBlock`. Fires one-shot callbacks at specific blocks, then re-schedules the next one from within the callback.

```
startCreateLoop() → fires every 4500 blocks (~30 min)
startResolveLoop() → fires every 4500 blocks (~30 min)
```

**Gas efficiency:** 96 fires/day at ~0.005 STT each = 0.48 STT/day total.

Key functions:
- `startCreateLoop()` / `stopCreateLoop()` — manage create scheduling
- `startResolveLoop()` / `stopResolveLoop()` — manage resolve scheduling
- `setCreateInterval(uint64)` — adjust create frequency
- `setResolveInterval(uint64)` — adjust resolve frequency
- `getStats()` — returns (createFires, resolveFires, autoResolves, marketsCreated, lastCreateBlock, lastResolveBlock)

### SantioraFinalV2

AI brain contract. Calls `inferToolsChat` on Somnia Agent Platform to generate markets and resolve outcomes.

Features:
- Market creation via LLM (generates question, odds, deadline)
- Agent-to-agent resolution (Resolver + Verifier cross-check)
- Rules engine (daily limits, cooldowns, confidence thresholds)
- Callback pattern for async agent responses

Key functions:
- `createMarket(string category)` — triggers LLM to generate market
- `autoResolveExpired(uint256 marketId)` — triggers resolution chain
- `getMarket(uint256 id)` — returns full market data
- `canCreateMarket()` — checks rules (daily limit, cooldown)

### PredictionMarketSUSD

Individual market instance. Handles betting mechanics with SUSD collateral.

- `buyYes(uint256 amount)` / `buyNo(uint256 amount)` — place bets
- `claimWinnings()` — claim payout after resolution
- `getMarketInfo()` — returns (question, deadline, status, outcome, collateral, yesSupply, noSupply)

## Deployment

Deploy using viem (recommended for Somnia):

```javascript
const { createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const account = privateKeyToAccount(PRIVATE_KEY);
const wallet = createWalletClient({ account, chain: somnia, transport: http() });

const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [FINAL_V2_ADDRESS, 4500n, 4500n],
});
```

## Deployed Addresses (Somnia Testnet)

| Contract | Address |
|----------|---------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` |
| MarketFactory | `0x307df7Ec35FbE7F50C7aBE1Ab56a6637Db3A5972` |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |

## Somnia-Specific Notes

- **Compiler:** Solidity 0.8.30, EVM target Paris
- **Reactivity:** Import from `@somnia-chain/reactivity-contracts`
- **Agent calls:** Use `inferToolsChat` selector `0xd0683905`, deposit 0.33 STT per call
- **Minimum balance:** Contracts using reactivity need >= 32 STT
- **Gas limits:** Use 5M+ for complex operations, 20M for create chain (inferToolsChat)

## Configuration After Deploy

```javascript
// 1. Point FinalV2 to ReactiveV2
await finalV2.setReactiveContract(reactiveV2Address);

// 2. Fund both contracts
await sendTransaction({ to: reactiveV2, value: parseEther("40") });
await sendTransaction({ to: finalV2, value: parseEther("20") });

// 3. Start loops (5M gas required)
await reactiveV2.startCreateLoop({ gas: 5_000_000n });
await reactiveV2.startResolveLoop({ gas: 5_000_000n });
```

## License

MIT
