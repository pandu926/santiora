# Smart Contracts

Complete reference for all deployed Santiora contracts on Somnia Testnet.

## Contract Map

```
SantioraReactiveV2 (Scheduler)
    │
    ├── calls → SantioraFinalV2 (Brain)
    │               │
    │               ├── calls → Agent Platform (LLM/API agents)
    │               └── registers → MarketRegistry
    │
    └── self-schedules via SomniaExtensions

PredictionMarketSUSD (Individual markets)
    ├── uses → SUSD (ERC20 collateral)
    └── mints → ShareToken (YES/NO ERC20)

SantioraFaucet (Test tokens)
    └── distributes → STT + SUSD
```

## SantioraReactiveV2

**Address:** `0x9a907ccbf539fe98f76f913d6d8c65190b75d248`

Autonomous scheduler using `scheduleSubscriptionAtBlock`. See [Reactivity System](./reactivity.md) for detailed documentation.

### ABI (Key Functions)

```json
[
  {
    "type": "function",
    "name": "startCreateLoop",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "startResolveLoop",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "stopCreateLoop",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "stopResolveLoop",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCreateInterval",
    "inputs": [{ "name": "_blocks", "type": "uint64" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setResolveInterval",
    "inputs": [{ "name": "_blocks", "type": "uint64" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setGasLimits",
    "inputs": [
      { "name": "_create", "type": "uint64" },
      { "name": "_resolve", "type": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getStats",
    "inputs": [],
    "outputs": [
      { "name": "createFires", "type": "uint256" },
      { "name": "resolveFires", "type": "uint256" },
      { "name": "autoResolves", "type": "uint256" },
      { "name": "marketsCreated", "type": "uint256" },
      { "name": "lastCreateBlock", "type": "uint256" },
      { "name": "lastResolveBlock", "type": "uint256" }
    ],
    "stateMutability": "view"
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
    "name": "withdrawAll",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
]
```

### Events

```solidity
event CreateFired(uint256 blockNumber, uint256 timestamp, string category);
event CreateSkipped(uint256 blockNumber, string reason);
event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);
```

## SantioraFinalV2

**Address:** `0x699924676bcea563a3171c916a01a4ccafb63ee8`

AI brain contract. Creates markets via LLM inference and resolves them with agent-to-agent verification.

### ABI (Key Functions)

```json
[
  {
    "type": "function",
    "name": "createMarket",
    "inputs": [{ "name": "category", "type": "string" }],
    "outputs": [{ "name": "marketId", "type": "uint256" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "autoResolveExpired",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getMarket",
    "inputs": [{ "name": "id", "type": "uint256" }],
    "outputs": [
      { "name": "question", "type": "string" },
      { "name": "odds", "type": "uint256" },
      { "name": "deadline", "type": "uint256" },
      { "name": "category", "type": "string" },
      { "name": "status", "type": "uint8" },
      { "name": "outcome", "type": "string" },
      { "name": "confidence", "type": "uint256" },
      { "name": "resolutionData", "type": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getNextCategory",
    "inputs": [],
    "outputs": [{ "type": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "canCreateMarket",
    "inputs": [],
    "outputs": [
      { "name": "allowed", "type": "bool" },
      { "name": "reason", "type": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStats",
    "inputs": [],
    "outputs": [
      { "type": "uint256" },
      { "type": "uint256" },
      { "type": "uint256" },
      { "type": "uint256" },
      { "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRulesState",
    "inputs": [],
    "outputs": [
      { "type": "uint256" },
      { "type": "uint256" },
      { "type": "uint256" },
      { "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setReactiveContract",
    "inputs": [{ "name": "_reactive", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
]
```

### Market Status Enum

```solidity
enum MarketStatus {
    Created,    // 0 — waiting for LLM response
    Active,     // 1 — open for betting
    Resolving,  // 2 — resolution in progress
    Resolved,   // 3 — outcome determined
    Settled,    // 4 — payouts distributed
    Failed      // 5 — resolution failed
}
```

### Events

```solidity
event MarketCreated(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence);
event AgentToAgentVerification(uint256 indexed marketId, string resolverOutcome, string verifierOutcome, bool match);
event Decision(uint256 indexed requestId, uint8 requestType, string data);
event BrainResponse(uint256 indexed requestId, string response);
event ResolutionFailed(uint256 indexed marketId, string reason);
```

## MarketRegistry

**Address:** `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677`

On-chain index of all markets. Frontend reads from here for market listings.

### ABI

```json
[
  {
    "type": "function",
    "name": "getMarket",
    "inputs": [{ "type": "uint256" }],
    "outputs": [
      { "name": "marketAddress", "type": "address" },
      { "name": "question", "type": "string" },
      { "name": "odds", "type": "uint256" },
      { "name": "deadline", "type": "uint256" },
      { "name": "category", "type": "string" },
      { "name": "status", "type": "uint8" },
      { "name": "outcome", "type": "string" },
      { "name": "confidence", "type": "uint256" },
      { "name": "isSUSD", "type": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getActiveCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getResolvedCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  }
]
```

## PredictionMarketSUSD

Individual market instances deployed by MarketFactoryLite. Each market is a standalone contract.

### ABI (Key Functions)

```json
[
  {
    "type": "function",
    "name": "buyYes",
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "buyNo",
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimWinnings",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getMarketInfo",
    "inputs": [],
    "outputs": [
      { "name": "question", "type": "string" },
      { "name": "deadline", "type": "uint256" },
      { "name": "status", "type": "uint8" },
      { "name": "outcome", "type": "bool" },
      { "name": "totalCollateral", "type": "uint256" },
      { "name": "yesSupply", "type": "uint256" },
      { "name": "noSupply", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "yesToken",
    "inputs": [],
    "outputs": [{ "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "noToken",
    "inputs": [],
    "outputs": [{ "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "resolutionConfidence",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  }
]
```

### Betting Mechanics

1. User approves SUSD spending: `SUSD.approve(marketAddress, amount)`
2. User calls `buyYes(amount)` or `buyNo(amount)`
3. Market mints corresponding ShareToken (YES or NO ERC20)
4. Share price determined by current supply ratio

### Payout Calculation

After resolution:
- If outcome is YES: YES token holders claim proportional share of total collateral
- If outcome is NO: NO token holders claim proportional share
- Payout = (userShares / winningSupply) × totalCollateral

## SUSD Token

**Address:** `0xB553c0003C3F0419abD358A2edD16191fC86ef90`

Standard ERC20 stablecoin used as betting collateral. Mintable via faucet for testing.

### Important: Gas on Somnia

SUSD `approve()` requires **5,000,000 gas** on Somnia (not the standard 50K). This is a Somnia-specific behavior. Always use high gas limits for ERC20 operations:

```javascript
await walletClient.writeContract({
  address: SUSD_ADDRESS,
  abi: erc20Abi,
  functionName: "approve",
  args: [marketAddress, amount],
  gas: 5_000_000n,  // Somnia requires high gas for approve
});
```

## SantioraFaucet

**Address:** `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1`

Distributes test tokens. One claim per address per 24 hours.

### ABI

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

## Deployment Addresses (All)

| Contract | Address | Status |
|----------|---------|--------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` | Active |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` | Active |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` | Active |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Active |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Active |
| MarketFactory | `0x307df7Ec35FbE7F50C7aBE1Ab56a6637Db3A5972` | Active |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia System |
| Reactivity Precompile | `0x0100` | Somnia System |

## Compilation

```bash
cd contracts
npm install
npx hardhat compile
```

Compiler: Solidity 0.8.30, EVM target: Paris.

## Verification

Contracts can be verified on the Somnia explorer:

```bash
npx hardhat verify --network somnia <address> <constructor-args>
```
