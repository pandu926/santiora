# Deployment Guide

Step-by-step guide to deploying and configuring Santiora V5 contracts on Somnia Testnet.

## Prerequisites

- Node.js 18+
- Private key with STT balance (minimum 5 STT recommended for deployment and initial funding)
- Somnia Testnet RPC: `https://dream-rpc.somnia.network`
- Chain ID: `50312`
- Explorer: `https://shannon-explorer.somnia.network`

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

## Deployed V5 Addresses (Reference)

These are the canonical V5 contract addresses on Somnia Testnet:

| Contract | Address |
|----------|---------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` |

| Agent | ID |
|-------|----|
| LLM Agent (market creation) | `12847293847561029384` |
| JSON API Agent (resolution) | `13174292974160097713` |

## Deployment Order

```
1. V5Prompts (no constructor args)
2. SantioraV5 (registryAddr, promptsAddr) -- registryAddr can be address(0)
3. Fund SantioraV5 with STT
4. SantioraReactiveV5 (v5Addr, createInterval, resolveInterval)
5. Fund reactive contract with STT
6. SantioraV5.setReactiveContract(reactiveAddr)
7. SantioraReactiveV5.startCreateLoop() + startResolveLoop()
8. Configure frontend environment variable
```

## Step 1: Compile

```bash
npx hardhat compile
```

Expected output: `Compiled N Solidity files successfully`

## Step 2: Deploy V5Prompts

V5Prompts takes no constructor arguments. It holds the prompt templates used by the AI agents for market creation and resolution.

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

async function deployPrompts() {
  const artifact = JSON.parse(
    fs.readFileSync("artifacts/src/agents/V5Prompts.sol/V5Prompts.json")
  );

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [], // No constructor arguments
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("V5Prompts deployed:", receipt.contractAddress);
  return receipt.contractAddress;
}
```

## Step 3: Deploy SantioraV5

SantioraV5 is the core contract. Constructor takes `(address registryAddr, address promptsAddr)`. The registry address can be `address(0)` if you do not have a separate market registry. SantioraV5 manages its own market store in that case.

```javascript
async function deployV5(promptsAddress) {
  const artifact = JSON.parse(
    fs.readFileSync("artifacts/src/agents/SantioraV5.sol/SantioraV5.json")
  );

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [
      "0x0000000000000000000000000000000000000000", // registryAddr (address(0) for self-managed)
      promptsAddress,                                 // V5Prompts address
    ],
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("SantioraV5 deployed:", receipt.contractAddress);
  return receipt.contractAddress;
}
```

## Step 4: Fund SantioraV5

SantioraV5 needs STT to pay for AI agent inference calls on the Agent Platform. Each market creation costs approximately 0.72 STT in agent fees. Fund with at least 1 STT, more for sustained operation.

```javascript
const { parseEther } = require("viem");

async function fundV5(v5Address) {
  const hash = await wallet.sendTransaction({
    to: v5Address,
    value: parseEther("5"), // 5 STT -- funds ~6-7 market creations
  });

  await client.waitForTransactionReceipt({ hash });
  console.log("SantioraV5 funded with 5 STT");

  const balance = await client.getBalance({ address: v5Address });
  console.log("SantioraV5 balance:", formatEther(balance), "STT");
}
```

**Recommendation:** Start with 5 STT for development. Each market costs approximately 0.72 STT through the Agent Platform. Monitor balance and top up as needed.

## Step 5: Deploy SantioraReactiveV5

SantioraReactiveV5 handles the autonomous scheduling. Constructor takes `(address v5Addr, uint64 createIntervalBlocks, uint64 resolveIntervalBlocks)`.

```javascript
async function deployReactive(v5Address) {
  const artifact = JSON.parse(
    fs.readFileSync("artifacts/src/agents/SantioraReactiveV5.sol/SantioraReactiveV5.json")
  );

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [
      v5Address,
      300n,   // Create every 300 blocks (~15 min at ~3s block time)
      600n,   // Resolve every 600 blocks (~30 min)
    ],
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("SantioraReactiveV5 deployed:", receipt.contractAddress);
  return receipt.contractAddress;
}
```

**Interval guidance:**

| Interval | Approx. Time | Use Case |
|----------|-------------|----------|
| 100 blocks | ~5 min | Fast demo cycling |
| 300 blocks | ~15 min | Active development |
| 600 blocks | ~30 min | Production |
| 1200 blocks | ~1 hr | Conservative / low-cost |

## Step 6: Fund SantioraReactiveV5

The reactive contract needs STT for gas when callbacks fire and subscriptions are created.

```javascript
async function fundReactive(reactiveAddress) {
  const hash = await wallet.sendTransaction({
    to: reactiveAddress,
    value: parseEther("3"), // 3 STT
  });

  await client.waitForTransactionReceipt({ hash });
  console.log("SantioraReactiveV5 funded with 3 STT");
}
```

## Step 7: Link Contracts

Point SantioraV5 to the reactive contract so it accepts scheduling calls:

```javascript
const v5Abi = JSON.parse(
  fs.readFileSync("artifacts/src/agents/SantioraV5.sol/SantioraV5.json")
).abi;

async function setReactive(v5Address, reactiveAddress) {
  const hash = await wallet.writeContract({
    address: v5Address,
    abi: v5Abi,
    functionName: "setReactiveContract",
    args: [reactiveAddress],
    gas: 500_000n,
  });

  await client.waitForTransactionReceipt({ hash });
  console.log("SantioraV5.setReactiveContract done");
}
```

## Step 8: Start Autonomous Loops

Start both loops. Each call requires around 5M gas for the subscription creation precompile interaction.

```javascript
const reactiveAbi = JSON.parse(
  fs.readFileSync("artifacts/src/agents/SantioraReactiveV5.sol/SantioraReactiveV5.json")
).abi;

async function startLoops(reactiveAddress) {
  // Start create loop
  const createHash = await wallet.writeContract({
    address: reactiveAddress,
    abi: reactiveAbi,
    functionName: "startCreateLoop",
    gas: 5_000_000n,
  });
  await client.waitForTransactionReceipt({ hash: createHash });
  console.log("Create loop started");

  // Start resolve loop
  const resolveHash = await wallet.writeContract({
    address: reactiveAddress,
    abi: reactiveAbi,
    functionName: "startResolveLoop",
    gas: 5_000_000n,
  });
  await client.waitForTransactionReceipt({ hash: resolveHash });
  console.log("Resolve loop started");
}
```

## Step 9: Verify Deployment

```javascript
async function verify(reactiveAddress, v5Address) {
  const stats = await client.readContract({
    address: reactiveAddress,
    abi: reactiveAbi,
    functionName: "getStats",
  });

  const [createFires, resolveFires, autoResolves, marketsCreated, lastCreate, lastResolve] = stats;

  console.log("=== Deployment Verified ===");
  console.log("Create fires:", createFires.toString());
  console.log("Resolve fires:", resolveFires.toString());
  console.log("Auto-resolves:", autoResolves.toString());
  console.log("Markets created:", marketsCreated.toString());
  console.log("Last create block:", lastCreate.toString());
  console.log("Last resolve block:", lastResolve.toString());

  // Check subscription IDs (non-zero = active)
  const createSubId = await client.readContract({
    address: reactiveAddress,
    abi: reactiveAbi,
    functionName: "createSubscriptionId",
  });
  const resolveSubId = await client.readContract({
    address: reactiveAddress,
    abi: reactiveAbi,
    functionName: "resolveSubscriptionId",
  });

  console.log("Create subscription active:", createSubId > 0n);
  console.log("Resolve subscription active:", resolveSubId > 0n);

  // Check balances
  const v5Balance = await client.getBalance({ address: v5Address });
  const reactiveBalance = await client.getBalance({ address: reactiveAddress });
  console.log("SantioraV5 balance:", formatEther(v5Balance), "STT");
  console.log("ReactiveV5 balance:", formatEther(reactiveBalance), "STT");
}
```

## Step 10: Configure Frontend

Set the SantioraV5 address in the frontend environment. Create or update `frontend/.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
SANTIORA_V5=0x_your_deployed_v5_address
```

Then rebuild:

```bash
cd frontend
npm run build
```

If using PM2 to serve:

```bash
pm2 restart santiora
```

## Contract Verification on Explorer

Verify contracts on the Somnia explorer at `https://shannon-explorer.somnia.network`.

### Using Hardhat Verification

If a Hardhat verification plugin is configured for Somnia:

```bash
npx hardhat verify --network somnia <V5PROMPTS_ADDRESS>
npx hardhat verify --network somnia <SANTIORA_V5_ADDRESS> "0x0000000000000000000000000000000000000000" <V5PROMPTS_ADDRESS>
npx hardhat verify --network somnia <REACTIVE_V5_ADDRESS> <SANTIORA_V5_ADDRESS> 300 600
```

### Manual Verification

If the explorer supports manual verification (Blockscout-based), navigate to each contract address, click **Verify & Publish**, and provide:

1. **V5Prompts**: No constructor arguments. Select Solidity compiler version matching your build.
2. **SantioraV5**: Constructor arguments: `0000000000000000000000000000000000000000` (address(0) for registry), then the V5Prompts address.
3. **SantioraReactiveV5**: Constructor arguments: SantioraV5 address, create interval (e.g. `300` as uint64), resolve interval (e.g. `600` as uint64).

For all three, enable optimization if it was enabled during compilation, and upload the flattened source or use the standard JSON input method.

## Full Deployment Script

Combine all steps into a single script for convenience. Save as `deploy-v5.js` in the contracts directory:

```javascript
// deploy-v5.js -- Full Santiora V5 deployment
const { createWalletClient, createPublicClient, http, parseEther, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { defineChain } = require("viem");
const fs = require("fs");

require("dotenv").config();

const somnia = defineChain({
  id: 50312,
  name: "Somnia",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const client = createPublicClient({ chain: somnia, transport: http() });
const wallet = createWalletClient({ account, chain: somnia, transport: http() });

async function deploy(artifactPath, args = []) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt.contractAddress;
}

async function main() {
  console.log("=== Santiora V5 Deployment ===\n");

  // Step 1-2: Deploy Prompts
  console.log("Deploying V5Prompts...");
  const prompts = await deploy("artifacts/src/agents/V5Prompts.sol/V5Prompts.json");
  console.log(`V5Prompts: ${prompts}`);

  // Step 3: Deploy SantioraV5
  console.log("\nDeploying SantioraV5...");
  const v5 = await deploy("artifacts/src/agents/SantioraV5.sol/SantioraV5.json", [
    "0x0000000000000000000000000000000000000000",
    prompts,
  ]);
  console.log(`SantioraV5: ${v5}`);

  // Step 4: Fund SantioraV5
  console.log("\nFunding SantioraV5...");
  let hash = await wallet.sendTransaction({ to: v5, value: parseEther("5") });
  await client.waitForTransactionReceipt({ hash });
  console.log(`SantioraV5 funded: ${formatEther(await client.getBalance({ address: v5 }))} STT`);

  // Step 5: Deploy Reactive
  console.log("\nDeploying SantioraReactiveV5...");
  const reactive = await deploy("artifacts/src/agents/SantioraReactiveV5.sol/SantioraReactiveV5.json", [
    v5, 300n, 600n,
  ]);
  console.log(`SantioraReactiveV5: ${reactive}`);

  // Step 6: Fund Reactive
  console.log("\nFunding SantioraReactiveV5...");
  hash = await wallet.sendTransaction({ to: reactive, value: parseEther("3") });
  await client.waitForTransactionReceipt({ hash });
  console.log(`Reactive funded: ${formatEther(await client.getBalance({ address: reactive }))} STT`);

  // Step 7: Link contracts
  console.log("\nLinking contracts...");
  const v5Abi = JSON.parse(fs.readFileSync("artifacts/src/agents/SantioraV5.sol/SantioraV5.json")).abi;
  hash = await wallet.writeContract({
    address: v5, abi: v5Abi, functionName: "setReactiveContract", args: [reactive], gas: 500_000n,
  });
  await client.waitForTransactionReceipt({ hash });
  console.log("SantioraV5.setReactiveContract done");

  // Step 8: Start loops
  console.log("\nStarting loops...");
  const reactiveAbi = JSON.parse(fs.readFileSync("artifacts/src/agents/SantioraReactiveV5.sol/SantioraReactiveV5.json")).abi;

  hash = await wallet.writeContract({
    address: reactive, abi: reactiveAbi, functionName: "startCreateLoop", gas: 5_000_000n,
  });
  await client.waitForTransactionReceipt({ hash });
  console.log("Create loop started");

  hash = await wallet.writeContract({
    address: reactive, abi: reactiveAbi, functionName: "startResolveLoop", gas: 5_000_000n,
  });
  await client.waitForTransactionReceipt({ hash });
  console.log("Resolve loop started");

  // Step 9: Print summary
  console.log("\n=== Deployment Summary ===");
  console.log(`V5Prompts:            ${prompts}`);
  console.log(`SantioraV5:           ${v5}`);
  console.log(`SantioraReactiveV5:   ${reactive}`);
  console.log(`\nFrontend env var:     SANTIORA_V5=${v5}`);
  console.log(`Explorer:             https://shannon-explorer.somnia.network/address/${v5}`);
}

main().catch(console.error);
```

Run it:

```bash
node deploy-v5.js
```

## Monitoring

Save this monitoring script as `monitor-v5.js` and run periodically to check contract health:

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

const V5 = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";
const REACTIVE = "0x_your_reactive_v5_address";

async function monitor() {
  const [v5Bal, reactiveBal, block] = await Promise.all([
    client.getBalance({ address: V5 }),
    client.getBalance({ address: REACTIVE }),
    client.getBlockNumber(),
  ]);

  console.log(`Block: ${block}`);
  console.log(`SantioraV5: ${formatEther(v5Bal)} STT`);
  console.log(`ReactiveV5: ${formatEther(reactiveBal)} STT`);

  if (Number(formatEther(v5Bal)) < 1) {
    console.warn("WARNING: SantioraV5 balance below 1 STT. Market creation will fail.");
  }
  if (Number(formatEther(reactiveBal)) < 1) {
    console.warn("WARNING: ReactiveV5 balance below 1 STT. Loops may fail.");
  }
}

monitor();
```

## Emergency: Withdraw Funds

If you need to recover STT from contracts, use the owner-only withdraw functions:

```javascript
// Withdraw from SantioraV5
await wallet.writeContract({
  address: V5,
  abi: v5Abi,
  functionName: "withdraw",
  args: [parseEther("1")],
  gas: 200_000n,
});

// Withdraw from SantioraReactiveV5
await wallet.writeContract({
  address: REACTIVE,
  abi: reactiveAbi,
  functionName: "withdrawAll",
  gas: 200_000n,
});
```

Withdrawing from SantioraReactiveV5 below the minimum needed for subscription creation will cause the next loop fire to fail to re-schedule. Stop loops first, then withdraw, then restart loops after re-funding.