# Deployment Guide

Step-by-step guide to deploying and configuring Santiora contracts on Somnia Testnet.

## Prerequisites

- Node.js 18+
- Private key with STT balance (minimum 100 STT recommended)
- Somnia Testnet RPC: `https://dream-rpc.somnia.network`
- Chain ID: `50312`

## Environment Setup

```bash
cd contracts
npm install

# Create .env
cat > .env << 'EOF'
RPC_URL=https://dream-rpc.somnia.network
WALLET_PRIVATE_KEY=0x_your_private_key_here
EOF
```

## Deployment Order

Contracts must be deployed in this order due to dependencies:

```
1. SUSD (or use existing: 0xB553c0003C3F0419abD358A2edD16191fC86ef90)
2. MarketRegistry
3. SantioraFinalV2 (needs: registry address, platform address)
4. SantioraReactiveV2 (needs: FinalV2 address)
5. Configure: FinalV2.setReactiveContract(ReactiveV2)
6. Fund: Send STT to both contracts
7. Start: ReactiveV2.startCreateLoop() + startResolveLoop()
```

## Step 1: Compile

```bash
npx hardhat compile
```

Expected output: `Compiled N Solidity files successfully`

## Step 2: Deploy SantioraFinalV2

```javascript
const { createWalletClient, createPublicClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { defineChain } = require("viem");
const fs = require("fs");

const somnia = defineChain({
  id: 50312,
  name: "Somnia",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const client = createPublicClient({ chain: somnia, transport: http() });
const wallet = createWalletClient({ account, chain: somnia, transport: http() });

const artifact = JSON.parse(
  fs.readFileSync("artifacts/src/agents/SantioraFinalV2.sol/SantioraFinalV2.json")
);

async function deploy() {
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [
      "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776", // Agent Platform
      "0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677", // MarketRegistry
    ],
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("FinalV2 deployed:", receipt.contractAddress);
}
```

## Step 3: Deploy SantioraReactiveV2

```javascript
const artifact = JSON.parse(
  fs.readFileSync("artifacts/src/agents/SantioraReactiveV2.sol/SantioraReactiveV2.json")
);

async function deploy() {
  const FINAL_V2 = "0x..."; // From step 2

  // Constructor: (address finalV2, uint64 createInterval, uint64 resolveInterval)
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [
      FINAL_V2,
      4500n,  // Create every 4500 blocks (~30 min)
      4500n,  // Resolve every 4500 blocks (~30 min)
    ],
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("ReactiveV2 deployed:", receipt.contractAddress);
}
```

**Note:** Gas estimation for deployment is high (~31M). Let viem estimate automatically or set `gas: 35_000_000n`.

## Step 4: Configure FinalV2

Point FinalV2 to the new ReactiveV2 so it accepts calls:

```javascript
await wallet.writeContract({
  address: FINAL_V2,
  abi: finalV2Abi,
  functionName: "setReactiveContract",
  args: [REACTIVE_V2],
  gas: 500_000n,
});
```

## Step 5: Fund Contracts

Both contracts need STT to operate:

| Contract | Minimum | Recommended | Purpose |
|----------|---------|-------------|---------|
| ReactiveV2 | 32 STT | 40 STT | Subscription minimum + gas for fires |
| FinalV2 | 5 STT | 20 STT | Agent calls (0.33 STT each) |

```javascript
// Fund ReactiveV2
await wallet.sendTransaction({
  to: REACTIVE_V2,
  value: parseEther("40"),
});

// Fund FinalV2
await wallet.sendTransaction({
  to: FINAL_V2,
  value: parseEther("20"),
});
```

## Step 6: Start Loops

```javascript
// Start resolve loop
await wallet.writeContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "startResolveLoop",
  gas: 5_000_000n, // Needs 5M for subscription creation
});

// Start create loop
await wallet.writeContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "startCreateLoop",
  gas: 5_000_000n,
});
```

**Important:** `startCreateLoop` and `startResolveLoop` require 5M gas because they call the Somnia Reactivity Precompile internally (~210K gas for subscription creation plus overhead).

## Step 7: Verify

```javascript
const stats = await client.readContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "getStats",
});

const [createFires, resolveFires, autoResolves, marketsCreated, lastCreate, lastResolve] = stats;
console.log("Create fires:", createFires);
console.log("Resolve fires:", resolveFires);

// Check subscription IDs (non-zero = active)
const createSubId = await client.readContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "createSubscriptionId",
});
console.log("Create subscription active:", createSubId > 0n);
```

## Frontend Configuration

Update contract addresses in `frontend/src/lib/config.ts`:

```typescript
export const CONTRACTS = {
  SANTIORA_FINAL_V2: "0x...",      // Your FinalV2 address
  SANTIORA_REACTIVE_V2: "0x...",   // Your ReactiveV2 address
  // ... other contracts
} as const;
```

And in `frontend/src/lib/onchain.ts`:

```typescript
export const SANTIORA_FINAL_V2 = "0x..." as const;
export const SANTIORA_REACTIVE_V2 = "0x..." as const;
```

Then rebuild:

```bash
cd frontend
npm run build
pm2 restart santiora
```

## Monitoring Script

Save as `monitor.js` and run periodically:

```javascript
const { createPublicClient, http, formatEther } = require("viem");
const { defineChain } = require("viem");

const somnia = defineChain({
  id: 50312,
  name: "Somnia",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

const client = createPublicClient({ chain: somnia, transport: http() });

const REACTIVE = "0x9a907ccbf539fe98f76f913d6d8c65190b75d248";
const FINAL_V2 = "0x699924676bcea563a3171c916a01a4ccafb63ee8";

async function monitor() {
  const [reactiveBal, finalBal, block] = await Promise.all([
    client.getBalance({ address: REACTIVE }),
    client.getBalance({ address: FINAL_V2 }),
    client.getBlockNumber(),
  ]);

  console.log(`Block: ${block}`);
  console.log(`ReactiveV2: ${formatEther(reactiveBal)} STT`);
  console.log(`FinalV2: ${formatEther(finalBal)} STT`);

  // Alert if low
  if (Number(formatEther(reactiveBal)) < 35) {
    console.warn("WARNING: ReactiveV2 balance below 35 STT!");
  }
  if (Number(formatEther(finalBal)) < 2) {
    console.warn("WARNING: FinalV2 balance below 2 STT!");
  }
}

monitor();
```

## Emergency: Withdraw Funds

If you need to recover STT from contracts:

```javascript
// Withdraw all from ReactiveV2
await wallet.writeContract({
  address: REACTIVE_V2,
  abi: reactiveV2Abi,
  functionName: "withdrawAll",
  gas: 200_000n,
});

// Withdraw specific amount from FinalV2
await wallet.writeContract({
  address: FINAL_V2,
  abi: finalV2Abi,
  functionName: "withdraw",
  args: [parseEther("10")],
  gas: 200_000n,
});
```

**Note:** Withdrawing below 32 STT from ReactiveV2 will prevent new subscriptions from being created. The current loop will fire one more time but fail to re-schedule.
