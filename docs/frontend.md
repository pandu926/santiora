# Frontend (V5)

Next.js 15 application serving Santiora V5 on Somnia Testnet. All market data is read directly from the SantioraV5 contract — no backend, no database, no indexer required.

**Live URL:** https://santiora.rbexp.com

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.3 | App router, SSR, file-based routing |
| React | 19.1 | UI framework |
| TypeScript | latest | Type safety |
| wagmi | 2.x | React hooks for contract reads and transactions |
| RainbowKit | 2.x | Wallet connection modal (MetaMask, WalletConnect, Coinbase) |
| viem | 2.x | Low-level chain interaction (publicClient, writeContract) |
| TailwindCSS | 4.x | Utility-first CSS framework |
| shadcn/ui | latest | Reusable UI component primitives |
| Framer Motion | 12.x | Page transitions and animations |
| Lightweight Charts | 4.2 | Odds chart visualization |

## Project Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                  # Root layout: fonts (Fira Sans/Code), Providers wrapper
│   ├── providers.tsx               # wagmi + RainbowKit + SpeedContext setup
│   ├── page.tsx                    # Landing/home page
│   └── (app)/                      # App layout shell (sidebar + navigation)
│       ├── markets/
│       │   ├── page.tsx            # Market list — grid/list view, search, status filter
│       │   └── [address]/
│       │       ├── page.tsx        # Market detail + betting sidebar + odds chart
│       │       ├── resolution-panel.tsx
│       │       └── claim-button.tsx
│       ├── ai/                     # AI agent dashboard (pipeline viz, stats)
│       ├── portfolio/              # User positions and bet history
│       ├── leaderboard/            # Top traders
│       ├── analytics/              # Platform analytics
│       ├── trending/               # Trending markets
│       ├── categories/             # Browse by category filter
│       ├── activity/               # Live activity feed
│       ├── faucet/                 # Claim test SUSD tokens
│       ├── oracle/                 # Oracle playground
│       ├── meta-markets/           # Meta-prediction markets
│       ├── explorer/               # On-chain market explorer
│       ├── transparency/           # Contract addresses and health
│       ├── status/                 # System health indicators
│       ├── search/                 # Global market search
│       └── profile/                # User profile
├── components/
│   ├── shared/                     # Reusable components
│   │   ├── PageTransition.tsx      # Framer Motion page wrapper
│   │   ├── PageHeader.tsx          # Consistent page title + action bar
│   │   ├── OddsChart.tsx           # TradingView-style odds history chart
│   │   ├── Skeletons.tsx           # Loading skeleton components
│   │   └── ...
│   ├── market/
│   │   ├── MarketCard.tsx          # Market card (grid/list card)
│   │   └── ...
│   └── ui/                         # shadcn/ui primitives (Button, Card, Badge, Input, etc.)
├── hooks/
│   ├── useOnchainMarkets.ts        # Fetch + poll all V5 markets (primary data hook)
│   ├── useMarkets.ts               # Paginated V5 market query (wagmi useReadContracts)
│   ├── useMarketDetail.ts          # Single market detail (registry + SUSD contract fallback)
│   ├── usePlaceBet.ts              # Betting state machine (approve → bet → confirmed)
│   ├── useOnchainActivity.ts       # Live on-chain event feed
│   ├── useResolution.ts            # Resolution status polling
│   ├── useClaim.ts                 # Claim winnings logic
│   ├── usePortfolio.ts             # User positions and balances
│   └── ...
├── lib/
│   ├── config.ts                   # Chain config (chain ID 50312, RPC, explorer), contract addresses, agent IDs
│   ├── onchain.ts                  # V5 data fetching — market enumeration, stats, agent metrics
│   ├── contracts.ts                # Legacy ABI definitions
│   ├── api.ts                      # Data transformation layer — converts on-chain data to API-shaped responses
│   ├── utils.ts                    # Shared utility functions (cn(), formatters)
│   └── abi/                        # Contract ABIs
│       ├── SUSD.ts                 # SUSD ERC-20 ABI + address
│       ├── PredictionMarketSUSD.ts # V5 betting contract ABI
│       └── ShareToken.ts           # YES/NO share token ABI
└── contexts/
    └── SpeedContext.tsx            # Chain speed indicator context
```

## No-Backend Architecture

Santiora V5 frontend has no backend server, no database, and no indexer. All data comes from two sources:

1. **SantioraV5 contract** (`0x6257d213a59f2278692baBB2eAB24Ddc0700B94B`) — the single source of truth for market data
2. **Somnia Testnet RPC** (`https://dream-rpc.somnia.network`) — read contract state and submit transactions

No subgraph, no multicall, no backend API. Every page hits the chain directly.

## V5 Data Fetching

### fetchV5Markets() — Primary Data Source

Located in `src/lib/onchain.ts`. Reads the entire market catalog from SantioraV5:

```typescript
export async function fetchV5Markets(): Promise<V5Market[]> {
  const count = await publicClient.readContract({
    address: SANTIORA_V5,
    abi: V5_ABI,
    functionName: "marketCount",
  });
  const total = Number(count);
  if (total === 0) return [];

  const markets: V5Market[] = [];
  for (let i = 0; i < total; i++) {
    const m = await publicClient.readContract({
      address: SANTIORA_V5,
      abi: V5_ABI,
      functionName: "markets",
      args: [BigInt(i)],
    });
    // Destructure: question, odds, deadline, category, status, outcome,
    //              confidence, createdAt, sourceUrl, rawResponse
    markets.push({ id: i, question, odds, deadline, category, status, ... });
  }
  return markets;
}
```

Each `markets(i)` call returns 10 fields — the complete market record is stored in a single contract mapping.

### fetchAllMarkets()

Filters to Active+ markets (status >= 1) and maps V5 data to the `OnchainMarket` interface used by the rest of the app:

```typescript
export async function fetchAllMarkets(): Promise<OnchainMarket[]> {
  const v5Markets = await fetchV5Markets();
  return v5Markets.filter(m => m.status >= 1).map(v5MarketToOnchain);
}
```

### During Migration

The codebase also supports a `DEPLOYED_MARKETS` array for manually listed markets and legacy `fetchFinalV2Stats()` / `fetchReactiveV2Stats()` functions — both of which now delegate to V5 stats under the hood. These exist for backward compatibility with existing pages and are gradually being replaced.

### No Multicall3

Somnia Testnet does not deploy Multicall3. Use individual `readContract` calls (sequentially or with `Promise.allSettled` for batching). V5 avoids the need for heavy batching since all markets are in a single contract:

```typescript
// V5: simple sequential reads — one contract, one loop
for (let i = 0; i < total; i++) {
  const market = await publicClient.readContract({
    address: SANTIORA_V5,
    functionName: "markets",
    args: [BigInt(i)],
  });
}
```

For paged views, `useMarkets.ts` uses wagmi's `useReadContracts` with a `Promise.allSettled`-style pattern.

## Key Hooks

### useOnchainMarkets

The primary data hook for the market listing page. Fetches all V5 markets and transforms them for display:

- Calls `fetchAllMarkets()` to get raw `OnchainMarket[]`
- Transforms to `MarketDisplay` (formatted dates, status labels, odds, volume)
- Deduplicates by question prefix (ignores duplicate markets)
- Sorts: Active first, then Expired, then Resolved, then Failed
- Polls every 30 seconds via `setInterval`

```typescript
interface MarketDisplay {
  id: string;
  address: string;
  question: string;
  category: string;
  deadline: string;       // formatted "Jun 15, 2026"
  deadlineTs: number;     // raw unix timestamp
  status: "active" | "expired" | "resolved" | "failed";
  yesOdds: number;        // 1-99, YES probability %
  volume: string;
  isSusd: boolean;        // true if market accepts SUSD bets
  aiConfidence: number;   // resolution confidence (0 if unresolved)
  outcome?: string;       // "YES" | "NO" (only if resolved)
}
```

### useMarkets

An alternative paginated hook using wagmi's `useReadContracts`. Reads markets [offset, offset+limit) from SantioraV5 in a single batch. Used by pages that need server-side-style pagination:

```typescript
export function useMarkets(offset: number, limit: number) {
  // Reads marketCount, then builds an array of useReadContracts calls
  // Returns { markets, isLoading, statusLabel }
}
```

### useMarketDetail

Fetches complete details for a single market by its ID/address:

1. Loads from `fetchAllMarkets()` (registry layer) to get metadata
2. If the market is an SUSD market, reads `getMarketInfo()`, `feePercent()`, token addresses, and `resolutionConfidence` from the PredictionMarketSUSD contract
3. Reads `totalSupply()` from both YES and NO share tokens
4. Calculates odds from supply ratio
5. Returns `{ market, yesOdds, noOdds, totalCollateral, isLoading, error, refetch }`

### usePlaceBet

State machine for the two-step V5 betting flow:

```typescript
type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

function usePlaceBet(marketAddress: string, onSuccess?: () => void) {
  // 1. Checks SUSD allowance — approves if needed (5M gas)
  // 2. Calls SantioraV5.bet(isYes, amount) with 10M gas
  // 3. Waits for TX receipt → sets state to "confirmed" → calls onSuccess (refetches)
  // Returns { placeBet, state, txHash, error, reset }
}
```

## Pages Overview

| Route | Page | Data Source |
|-------|------|-------------|
| `/` | Landing page | Static + V5Stats |
| `/markets` | Market list | `useOnchainMarkets()` → `fetchV5Markets()` |
| `/markets/[address]` | Market detail + betting | `useMarketDetail()` + `usePlaceBet()` |
| `/ai` | AI agent dashboard | `fetchV5Stats()`, `fetchAgentMetrics()` |
| `/portfolio` | User positions | `fetchUserPositions()` (placeholder) |
| `/leaderboard` | Top traders | Static + V5 market counts |
| `/analytics` | Platform stats | `fetchAllMarkets()` aggregate |
| `/faucet` | Claim test tokens | Faucet contract interaction |
| `/transparency` | Contract addresses | `config.ts` constants |
| `/categories` | Category browser | `useOnchainMarkets()` filtered by category |
| `/activity` | Live feed | `useOnchainActivity()` |

## Wallet Connection

Configured in `src/app/providers.tsx`:

```typescript
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";

const config = getDefaultConfig({
  appName: "Santiora",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "santiora-dev",
  chains: [somniaTestnet],
  ssr: true,
});

// Wraps app in WagmiProvider → QueryClientProvider → RainbowKitProvider → SpeedProvider
```

Users connect with their preferred wallet via the RainbowKit modal. Supported: MetaMask, WalletConnect, Coinbase Wallet, and any injected provider.

## Building and Running

### Development

```bash
cd frontend
npm install
cp .env.example .env.local   # Set NEXT_PUBLIC_WALLETCONNECT_ID
npm run dev
# → http://localhost:3000
```

### Production

```bash
npm run build
npm run start
# or with PM2:
pm2 start npm --name santiora -- start
```

### Environment Variables

```
NEXT_PUBLIC_WALLETCONNECT_ID=your_walletconnect_project_id
```

The frontend needs only this one environment variable. All contract addresses are hardcoded in `src/lib/config.ts`:

```typescript
export const CONTRACTS = {
  SANTIORA_V5: "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B",
  SANTIORA_V5_PROMPTS: "0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7",
  PLATFORM: "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  SUSD: "0xB553c0003C3F0419abD358A2edD16191fC86ef90",
  FAUCET: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
} as const;
```

## Somnia-Specific Considerations

### Gas Limits

Somnia requires higher gas than Ethereum mainnet:

| Operation | Ethereum | Somnia |
|-----------|----------|--------|
| ERC20 approve | 50,000 | 5,000,000 |
| Token transfer | 65,000 | 500,000 |
| V5.bet() | — | 10,000,000 |

Always set explicit `gas` in `writeContract` calls — never rely on auto-estimation.

### Block Time

Somnia produces blocks every 400ms:
- Transactions confirm in under 1 second
- Polling interval of 30 seconds is sufficient for UI updates
- Do not use block numbers for time calculations

### RPC Endpoints

```
HTTP:  https://dream-rpc.somnia.network
WS:    wss://dream-rpc.somnia.network/ws
Explorer: https://shannon-explorer.somnia.network
Chain ID: 50312
```

### No Multicall3

Somnia does not deploy Multicall3. Use individual `readContract` calls or wagmi's `useReadContracts` (which batches under the hood with sequential calls, not `eth_multicall`).

### Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/onchain.ts` | V5 contract reads — fetchV5Markets, fetchAllMarkets, fetchV5Stats, fetchAgentMetrics |
| `src/lib/api.ts` | Market response formatting — converts OnchainMarket to API-shaped MarketResponse |
| `src/lib/config.ts` | Chain config, RPC URLs, contract addresses, agent IDs |
| `src/hooks/useOnchainMarkets.ts` | Primary market data hook — fetches, deduplicates, sorts, polls |
| `src/hooks/useMarkets.ts` | Paginated market query with V5 ABI |
| `src/hooks/useMarketDetail.ts` | Single market detail with registry + SUSD contract fallback |
| `src/hooks/usePlaceBet.ts` | Betting state machine |
| `src/app/providers.tsx` | wagmi + RainbowKit setup |