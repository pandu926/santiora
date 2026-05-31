# Frontend

Next.js 15 application with React 19, wagmi, and RainbowKit. Reads all data directly from on-chain contracts — no backend required for core functionality.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.3 | App router, SSR, file-based routing |
| React | 19.1 | UI framework |
| wagmi | 2.x | React hooks for Ethereum |
| RainbowKit | 2.2 | Wallet connection UI |
| viem | 2.x | Low-level chain interaction |
| TailwindCSS | 4.x | Utility-first styling |
| shadcn/ui | latest | Component library |
| Framer Motion | 12.x | Animations |
| Lightweight Charts | 4.2 | TradingView-style odds charts |

## Project Structure

```
frontend/src/
├── app/
│   ├── (app)/                    # Main app layout (with sidebar/nav)
│   │   ├── markets/              # Market browsing and detail
│   │   │   ├── page.tsx          # Market list
│   │   │   └── [address]/        # Individual market
│   │   │       ├── page.tsx      # Market detail + betting
│   │   │       ├── resolution-panel.tsx
│   │   │       └── claim-button.tsx
│   │   ├── ai/                   # AI agent dashboard
│   │   │   ├── page.tsx          # Pipeline visualization + stats
│   │   │   └── agents/           # Individual agent pages
│   │   ├── portfolio/            # User positions and history
│   │   ├── leaderboard/          # Top traders
│   │   ├── analytics/            # Platform analytics
│   │   ├── trending/             # Trending markets
│   │   ├── categories/           # Browse by category
│   │   ├── activity/             # Live activity feed
│   │   ├── faucet/               # Claim test tokens
│   │   ├── oracle/               # Oracle playground
│   │   ├── meta-markets/         # Meta-prediction markets
│   │   ├── explorer/             # On-chain explorer
│   │   ├── transparency/         # Contract transparency
│   │   ├── status/               # System status
│   │   ├── search/               # Global search
│   │   └── profile/              # User profile
│   ├── layout.tsx                # Root layout (providers)
│   └── page.tsx                  # Landing/home
├── components/
│   ├── shared/                   # Reusable components
│   │   ├── PageTransition.tsx    # Framer Motion page wrapper
│   │   ├── OddsChart.tsx         # TradingView-style chart
│   │   └── ...
│   └── ui/                       # shadcn/ui components
├── hooks/
│   ├── useMarketDetail.ts        # Single market data
│   ├── usePlaceBet.ts            # Betting flow state machine
│   ├── useOnchainActivity.ts     # Live activity feed
│   └── ...
├── lib/
│   ├── config.ts                 # Chain config + contract addresses
│   ├── onchain.ts                # On-chain data fetching functions
│   ├── contracts.ts              # ABI definitions
│   └── abi/                      # Individual contract ABIs
└── providers/
    └── Web3Provider.tsx          # wagmi + RainbowKit setup
```

## On-Chain Data Layer

All market data is read directly from contracts. No indexer, no subgraph, no backend database.

### `src/lib/onchain.ts`

Core data fetching module. Key exports:

```typescript
// Fetch all markets from MarketRegistry
export async function fetchAllMarkets(): Promise<OnchainMarket[]>;

// Fetch single market detail (registry + SUSD contract fallback)
export async function fetchMarketDetail(address: Address): Promise<OnchainMarket | null>;

// Fetch user's positions across all markets
export async function fetchUserPositions(userAddress: Address): Promise<Position[]>;

// Fetch FinalV2 stats (markets created, resolved, rules)
export async function fetchFinalV2Stats(): Promise<FinalV2Stats>;

// Fetch ReactiveV2 stats (fires, scheduling)
export async function fetchReactiveV2Stats(): Promise<ReactiveV2Stats>;
```

### Data Fetching Pattern

Somnia does not support Multicall3. All batch reads use `Promise.allSettled`:

```typescript
const batchSize = 5;
for (let start = 0; start < count; start += batchSize) {
  const batch = await Promise.allSettled(
    Array.from({ length: end - start }, (_, i) =>
      publicClient.readContract({
        address: MARKET_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "getMarket",
        args: [BigInt(start + i)],
      })
    )
  );

  for (const result of batch) {
    if (result.status === "fulfilled") {
      // Process market data
    }
  }
}
```

**Why not Multicall3?** Somnia Testnet does not deploy the Multicall3 contract. `publicClient.multicall()` throws "Chain does not support multicall3". Use individual calls with `Promise.allSettled` for resilience.

## Key Hooks

### `useMarketDetail`

Fetches complete market data with odds calculation:

```typescript
interface UseMarketDetailReturn {
  market: MarketDetail | null;
  yesOdds: number;
  noOdds: number;
  totalCollateral: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function useMarketDetail(address: string): UseMarketDetailReturn;
```

Internally:
1. Checks MarketRegistry for market metadata
2. If SUSD market: reads `getMarketInfo()` from PredictionMarketSUSD contract
3. Calculates odds from YES/NO supply ratio
4. Polls every 30 seconds for live updates

### `usePlaceBet`

State machine for the two-step betting flow:

```typescript
type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

interface UsePlaceBetReturn {
  placeBet: (params: { isYes: boolean; amount: bigint }) => void;
  state: BetState;
  txHash: string | null;
  error: string | null;
  reset: () => void;
}

function usePlaceBet(marketAddress: string, onSuccess: () => void): UsePlaceBetReturn;
```

### `useOnchainActivity`

Live activity feed combining historical data + polling:

```typescript
interface ActivityItem {
  type: "bet" | "market_created" | "market_resolved" | "claim";
  timestamp: number;
  data: Record<string, unknown>;
}

function useOnchainActivity(): {
  activities: ActivityItem[];
  isLoading: boolean;
};
```

Uses raw topic-based event decoding (not ABI parsing) for resilience against contract version mismatches.

## Wallet Connection

Configured in `src/providers/Web3Provider.tsx`:

```typescript
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { somniaTestnet } from "@/lib/config";

const config = getDefaultConfig({
  appName: "Santiora",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [somniaTestnet],
});
```

Users connect via RainbowKit modal. Supported wallets: MetaMask, WalletConnect, Coinbase Wallet.

## AI Dashboard (`/ai`)

The AI page displays real-time autonomous system stats:

### Pipeline Visualization

Shows the full autonomous flow as connected steps:

```
ReactiveV2 → Schedule → FinalV2 → inferToolsChat → Market Active → Registry
```

Each step shows its current count and active/inactive state.

### Stats Grid

Reads from `fetchFinalV2Stats()` and `fetchReactiveV2Stats()`:

- Markets Created / Resolved
- Create Fires / Resolve Fires
- Balance (FinalV2 STT)
- Avg Confidence
- Daily limits and intervals

### Contract Transparency

Lists all deployed contracts with explorer links and live balance/stats.

## Building and Running

### Development

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Production Build

```bash
npm run build
npm run start
# or with PM2:
pm2 start npm --name santiora -- start
```

### Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

No other env vars needed — all contract addresses are in `src/lib/config.ts`.

## Somnia-Specific Considerations

### Gas Limits

Somnia requires higher gas limits than Ethereum mainnet for common operations:

| Operation | Ethereum | Somnia |
|-----------|----------|--------|
| ERC20 approve | 50,000 | 5,000,000 |
| Token transfer | 65,000 | 500,000 |
| Complex contract call | 200,000 | 5,000,000+ |

Always set explicit `gas` parameter in `writeContract` calls.

### Block Time

Somnia produces blocks every 400ms. This means:
- Transactions confirm in < 1 second
- Polling intervals can be shorter (15-30s is fine)
- Block numbers increase ~216,000 per day

### No Multicall3

Use `Promise.allSettled` batches instead of `publicClient.multicall()`. Batch size of 5 works well to avoid rate limiting.

### WebSocket RPC

Available at `wss://dream-rpc.somnia.network/ws` for real-time event subscriptions. Used by the activity feed for live updates.
