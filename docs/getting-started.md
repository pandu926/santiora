# Getting Started

Santiora is a fully autonomous AI prediction market protocol running on Somnia, an agentic L1 blockchain. There are no admins, no governance, and no human operators. AI agents create markets by detecting trending events from news, set odds by analyzing probabilities, manage liquidity through AMM pools, resolve outcomes by scraping and verifying real-world data, and settle bets. You bet. The AI handles everything else.

## User Onboarding

### 1. Add Somnia Testnet to Your Wallet

| Field | Value |
|-------|-------|
| Network Name | Somnia Testnet |
| RPC URL | `https://dream-rpc.somnia.network` |
| Chain ID | `50312` |
| Currency Symbol | STT |
| Explorer | `https://shannon-explorer.somnia.network` |

### 2. Get Test Tokens

Visit the faucet at [https://santiora.rbexp.com/faucet](https://santiora.rbexp.com/faucet), connect your wallet, and click **Claim**. You will receive 0.1 STT (for gas) and 1000 SUSD (for betting). One claim per address per 24 hours.

Alternatively, call the faucet contract directly:

```javascript
await walletClient.writeContract({
  address: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
  abi: [{ type: "function", name: "claim", inputs: [], outputs: [], stateMutability: "nonpayable" }],
  functionName: "claim",
  gas: 500_000n,
});
```

The faucet sends both STT and the betting token SUSD (`0xB553c0003C3F0419abD358A2edD16191fC86ef90`) in a single claim.

### 3. Browse Markets

Navigate to [https://santiora.rbexp.com/markets](https://santiora.rbexp.com/markets) to see all active prediction markets. The AI continuously creates markets across rotating categories (sports, crypto, finance, technology). Each market shows:

- **Question** — AI-generated from real news events
- **Odds** — YES/NO probability percentages set by the AI
- **Deadline** — when the market resolves
- **Category** — the event domain
- **Volume** — total SUSD wagered

### 4. Place a Bet

1. Click a market to open its detail page
2. Choose **YES** or **NO**
3. Enter your bet amount in SUSD
4. Click **Place Bet**
5. Confirm two transactions in your wallet: SUSD approval, then bet placement

### 5. Claim Winnings

When a market expires, the AI autonomously resolves it by verifying the real-world outcome. If you hold the winning side:

1. Go to the market detail page
2. A **Claim** button appears for winning positions
3. Click to receive your SUSD payout

### 6. Watch the AI Operate

Navigate to the AI dashboard to see the autonomous system in action. It shows real-time pipeline stats: how many markets were created, how many resolved, contract balances, and the current category being processed.

The entire system runs without human intervention. Reactive contracts on Somnia fire on a block-based schedule, the AI agent calls the LLM for market data, and the protocol self-perpetuates indefinitely as long as contract balances hold enough STT for gas.

## Developer Quick Start

### Prerequisites

- Node.js 18+
- A wallet with STT on Somnia Testnet (get STT from the faucet above)
- A WalletConnect Project ID for frontend development ([cloud.walletconnect.com](https://cloud.walletconnect.com))

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:3000` with hot reload.

### Production Build

```bash
npm run build
npm run start
```

### Project Layout

```
somnia/
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   ├── agents/         # V5Prompts, SantioraV5, SantioraReactiveV5
│   │   └── lib/            # Shared libraries
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/            # App routes (markets, faq, ai)
│   │   ├── lib/            # Core utilities and contract config
│   │   └── hooks/          # React hooks
│   └── package.json
└── docs/                   # This documentation
```

### V5 Contract Addresses (Somnia Testnet)

| Contract | Address |
|----------|---------|
| Santiora V5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` |
| V5 Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` |
| V5 Reactive | Check deployment output |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` |

### Architecture at a Glance

```
User  <-->  Frontend (Next.js)
                |
                | wagmi/viem (read/write contracts)
                v
           Somnia Chain
                |
      +---------+---------+
      |         |         |
  ReactiveV5  SantioraV5  Markets
  (scheduler)  (brain)    (betting)
      |         |
      |    Agent Platform
      |    (LLM inference:
      |     LLM Agent ID 12847293847561029384
      |     JSON API Agent ID 13174292974160097713)
      |         |
      +---------+
   self-perpetuating
   block-based scheduling loop
```

No backend server is required. The frontend reads directly from on-chain contracts, and the autonomous system (SantioraReactiveV5 + SantioraV5) operates independently of any off-chain infrastructure.

## Next Steps

- [Reactivity System](./reactivity.md) — How Somnia's block-based scheduling and autonomous loops work
- [Deployment Guide](./deployment.md) — Deploy your own V5 instance step by step
- [Architecture](./architecture.md) — Deep dive into the V5 contract architecture
- [Betting Flow](./betting-flow.md) — Complete bet lifecycle from wager to claim