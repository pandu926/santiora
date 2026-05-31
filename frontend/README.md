# Santiora Frontend

Next.js 15 application for the Santiora prediction market protocol.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Server Components)
- **React:** 19.1
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Wallet:** wagmi 2.x, RainbowKit 2.x, viem
- **Charts:** Lightweight Charts (TradingView)
- **Animation:** Framer Motion
- **Icons:** Lucide React, React Icons

## Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev
# → http://localhost:3000

# Production build
npm run build
npm run start

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

No other env vars needed — contract addresses are in `src/lib/config.ts`.

## Project Structure

```
src/
├── app/
│   ├── (app)/                # Main app routes
│   │   ├── markets/          # Market list + detail + betting
│   │   ├── ai/              # AI agent dashboard + arena
│   │   ├── docs/            # Technical documentation
│   │   ├── portfolio/       # User positions
│   │   ├── activity/        # Live activity feed
│   │   ├── analytics/       # Platform analytics
│   │   ├── leaderboard/     # Top traders
│   │   ├── oracle/          # Oracle playground
│   │   ├── faucet/          # Claim test tokens
│   │   └── ...              # 20+ routes
│   ├── layout.tsx           # Root layout (providers)
│   └── page.tsx             # Landing page
├── components/
│   ├── layout/              # AppHeader, Footer, MobileNav
│   ├── shared/              # PageTransition, OddsChart, LiveFeed
│   ├── docs/                # DocsSidebar, MarkdownRenderer
│   └── ui/                  # shadcn/ui components
├── hooks/
│   ├── useMarketDetail.ts   # Single market data + odds
│   ├── usePlaceBet.ts       # Betting state machine
│   └── useOnchainActivity.ts # Live event feed
├── lib/
│   ├── config.ts            # Chain config + contract addresses
│   ├── onchain.ts           # On-chain data fetching
│   ├── contracts.ts         # ABI definitions
│   └── docs-nav.ts          # Documentation navigation
└── providers/
    └── Web3Provider.tsx     # wagmi + RainbowKit setup
```

## Key Patterns

### On-Chain Data (No Backend)

All data reads directly from Somnia contracts. No indexer or subgraph needed.

```typescript
import { publicClient } from "@/lib/onchain";

const count = await publicClient.readContract({
  address: MARKET_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "getMarketCount",
});
```

### No Multicall3 on Somnia

Use `Promise.allSettled` batches instead:

```typescript
const results = await Promise.allSettled(
  ids.map((id) => publicClient.readContract({ ...args: [id] }))
);
```

### High Gas for ERC20

Somnia requires 5M gas for `approve`:

```typescript
await writeContract({
  functionName: "approve",
  args: [spender, amount],
  gas: 5_000_000n,
});
```

## Deployment

```bash
npm run build
pm2 start npm --name santiora -- start -- -p 3003
```

## Contract Addresses

Configured in `src/lib/config.ts`:

| Contract | Address |
|----------|---------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` |
