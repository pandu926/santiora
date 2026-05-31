# Getting Started

Get Santiora running locally in under 5 minutes.

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd somnia

# Install frontend dependencies
cd frontend && npm install

# Start development server
npm run dev
```

Open http://localhost:3000. Connect your wallet to Somnia Testnet.

## Somnia Testnet Setup

### Add Network to MetaMask

| Field | Value |
|-------|-------|
| Network Name | Somnia Testnet |
| RPC URL | `https://dream-rpc.somnia.network` |
| Chain ID | `50312` |
| Currency Symbol | STT |
| Explorer | `https://shannon-explorer.somnia.network` |

### Get Test Tokens

1. Visit the app at https://santiora.rbexp.com/faucet
2. Connect wallet
3. Click "Claim" — receive 0.1 STT + 1000 SUSD
4. One claim per address per 24 hours

Or call the faucet contract directly:

```javascript
await walletClient.writeContract({
  address: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
  abi: [{ type: "function", name: "claim", inputs: [], outputs: [], stateMutability: "nonpayable" }],
  functionName: "claim",
  gas: 500_000n,
});
```

## Project Layout

```
somnia/
├── contracts/              # Solidity smart contracts
│   ├── src/agents/         # AI agent contracts
│   ├── hardhat.config.ts   # Hardhat configuration
│   └── package.json
├── frontend/               # Next.js 15 application
│   ├── src/app/(app)/      # App routes
│   ├── src/lib/            # Core utilities
│   ├── src/hooks/          # React hooks
│   └── package.json
└── docs/                   # This documentation
```

## Contracts Setup

```bash
cd contracts
npm install
npx hardhat compile
```

### Running Tests

```bash
npx hardhat test
```

### Deploying

See [Deployment Guide](./deployment.md) for full instructions.

## Frontend Development

### Prerequisites

- Node.js 18+
- A WalletConnect Project ID (get one at https://cloud.walletconnect.com)

### Configuration

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Development Server

```bash
cd frontend
npm run dev
```

The app runs at http://localhost:3000 with hot reload.

### Production Build

```bash
npm run build
npm run start
```

### Type Checking

```bash
npx tsc --noEmit
```

## Using the App

### 1. Browse Markets

Navigate to `/markets` to see all active prediction markets. Each market shows:
- Question (AI-generated)
- Current odds (YES/NO percentage)
- Deadline
- Category
- Volume

### 2. Place a Bet

1. Click on a market to open the detail page
2. Choose YES or NO
3. Enter amount in SUSD
4. Click "Place Bet"
5. Approve two transactions: SUSD approval + bet placement

### 3. View Positions

Navigate to `/portfolio` to see your active positions across all markets.

### 4. Claim Winnings

After a market resolves:
1. Go to the market detail page
2. If you hold the winning side, a "Claim" button appears
3. Click to receive your SUSD payout

### 5. AI Dashboard

Navigate to `/ai` to see the autonomous system in action:
- Pipeline visualization (ReactiveV2 → FinalV2 → Agent → Market)
- Real-time stats (fires, creates, resolves)
- Contract balances and health
- Rules engine configuration

## Architecture at a Glance

```
User ←→ Frontend (Next.js)
              │
              │ wagmi/viem (read/write contracts)
              ▼
         Somnia Chain
              │
    ┌─────────┼─────────┐
    │         │         │
ReactiveV2  FinalV2  Markets
(scheduler) (brain)  (betting)
    │         │
    │    Agent Platform
    │    (LLM inference)
    │         │
    └─────────┘
     self-perpetuating
     scheduling loop
```

No backend server needed. The frontend reads directly from on-chain contracts. The autonomous system (ReactiveV2 + FinalV2) operates independently of the frontend.

## Next Steps

- [Architecture](./architecture.md) — Deep dive into system design
- [Reactivity System](./reactivity.md) — How autonomous scheduling works
- [AI Agents](./ai-agents.md) — Agent-to-agent verification chain
- [Betting Flow](./betting-flow.md) — Complete bet lifecycle
- [Deployment Guide](./deployment.md) — Deploy your own instance
