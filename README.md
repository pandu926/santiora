# Santiora

**Fully Autonomous AI Prediction Market Protocol on Somnia Agentic L1**

[![Live](https://img.shields.io/badge/demo-live-brightgreen)](https://santiora.rbexp.com)
[![Chain](https://img.shields.io/badge/chain-Somnia%20Testnet-purple)](https://shannon-explorer.somnia.network)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

Every prediction market today depends on humans:

| Operation | Polymarket | Augur | Traditional |
|-----------|-----------|-------|-------------|
| Create markets | Manual (team) | Manual + bond | Manual |
| Set odds | Manual/AMM | Manual | Bookmakers |
| Resolve outcomes | UMA oracle (human vote) | Human reporters | Centralized |
| Scheduling | Off-chain bots | Chainlink Keepers | Cron servers |
| Trust model | Trust UMA voters | Trust reporters | Trust company |

**Result:** Single points of failure, centralized dependencies, operational overhead, and trust assumptions everywhere.

## The Solution

**Santiora eliminates ALL human operation.** AI agents autonomously:

1. **Create markets** — LLM detects trending events, generates verifiable questions with initial odds
2. **Fetch real-world data** — JSON API agent fetches live sources to support resolution
3. **Resolve outcomes** — LLM interprets real-world data and returns YES/NO with confidence score
4. **Self-schedule** — Validator-guaranteed block triggers, zero external infrastructure
5. **Settle bets** — Winners claim proportional SUSD payouts from parimutuel pool

No admin keys. No governance. No team operation. **AI IS the protocol operator.**

## Why Somnia?

Santiora is **impossible on any other blockchain.** Here's why:

| Somnia Primitive | What It Does | Why No Other Chain Has It |
|-----------------|-------------|--------------------------|
| `inferToolsChat` | On-chain LLM inference (Qwen3-30B) with tool calling | Other chains require off-chain APIs for AI |
| `scheduleSubscriptionAtBlock` | One-shot block triggers, self-rescheduling | Others use Chainlink Keepers or cron servers |
| Native Reactivity | Validator-guaranteed callbacks at exact blocks | Others depend on external relayer networks |
| Agent Platform | Multi-step tool execution inside consensus | Others can't orchestrate tool calls natively |
| 101ms blocks | Sub-second finality | Enables real-time autonomous market operations |

**On Ethereum:** You'd need Chainlink Keepers ($$$), off-chain AI APIs (centralized), UMA oracle (human voters), and a server running 24/7.

**On Somnia:** Everything runs natively at the validator level. Zero external dependencies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCHEDULING LAYER                             │
│                                                                  │
│  SantioraReactiveV5                                             │
│  Uses scheduleSubscriptionAtBlock — fires exactly when needed   │
│  Self-reschedules from within callback                          │
│  Create loop: every 1 hour (35,744 blocks)                      │
│  Resolve loop: every 1 hour (35,744 blocks)                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BRAIN LAYER (V5 Pipeline)                    │
│                                                                  │
│  SantioraV5 — LLM-as-Orchestrator (yield & resume pattern)     │
│                                                                  │
│  CREATE PIPELINE:                                               │
│  inferToolsChat → LLM decides what to fetch                     │
│    → fetchString/fetchUint tool calls (JSON API agent)          │
│    → contract executes tools, resumes LLM with results          │
│    → LLM returns: { question, odds, deadline, source_url }      │
│    → Market stored on-chain                                     │
│                                                                  │
│  RESOLVE PIPELINE:                                              │
│  inferToolsChat → LLM fetches verification data                 │
│    → fetchString tools → resume with real-world data            │
│    → LLM returns: { outcome: YES/NO, confidence: 0-100 }       │
│    → confidence >= 70 → market resolved on-chain               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MARKET LAYER                               │
│                                                                  │
│  V5BettingPool — parimutuel pool per market                     │
│  bet(marketId, isYes, amount) → shares in YES/NO pool          │
│  claim(marketId) → proportional SUSD payout after resolution   │
│  Odds shift in real-time as bets come in                        │
│  Fee: 1.5% — no rug vectors                                     │
└─────────────────────────────────────────────────────────────────┘
```

## The Yield & Resume Pattern

The key innovation in V5: **LLM-as-Orchestrator**. The AI decides what data it needs, not the contract.

```
Contract calls inferToolsChat("create a prediction market about crypto")
  ↓
LLM yields: [
  { tool: "fetchString", args: { url: "https://api.coingecko.com/..." } },
  { tool: "fetchString", args: { url: "https://news.google.com/..." } }
]
  ↓
Contract executes tools in parallel (JSON API agent)
  ↓
Contract resumes LLM with results:
  "BTC price: $67,420 | Top news: ETF inflows hit record..."
  ↓
LLM returns final response:
  { question: "Will BTC exceed $70,000 by June 14, 2026?",
    odds: 38, deadline: "2026-06-14", source_url: "..." }
  ↓
Market goes live on-chain, odds = 38% YES / 62% NO
```

This is fully on-chain. No off-chain AI. No centralized API. LLM runs inside Somnia validators.

## Autonomous Workflow

```
Every 1 hour (self-scheduled, ~35,744 blocks at 101ms/block):

CREATE LOOP:
  Block N fires → ReactiveV5._onEvent()
    → SantioraV5.createMarket("crypto")
      → inferToolsChat → tool yield → execute → resume
        → LLM generates market → stored on-chain
    → ReactiveV5 schedules next fire at Block N+35744

RESOLVE LOOP:
  Block M fires → ReactiveV5._onEvent()
    → Scan all markets where block.timestamp >= deadline
      → SantioraV5.resolveMarket(marketId)
        → inferToolsChat → fetch real data → resume
          → LLM: { outcome: "NO", confidence: 85 }
            → confidence >= 70 → market resolved
              → V5BettingPool winners can claim
    → ReactiveV5 schedules next fire at Block M+35744

BOT TRADERS (santiora-bots PM2):
  5 wallets × 2000 SUSD each
  Every 5 minutes: scan active markets → bet 50-200 SUSD (60% bias to favorite)
  Auto-claim winnings after resolution
```

## Live Stats (as of June 2026)

- **Markets created:** 31+ autonomously by AI
- **Bot wallets betting:** 5 wallets active 24/7
- **Pool volume:** 300-500 SUSD per market
- **V5 contract balance:** ~11 STT
- **Create interval:** 1 hour (self-scheduled)
- **Zero human operations since deployment**

## Live Demo

**https://santiora.rbexp.com**

| Page | What It Shows |
|------|--------------|
| `/markets` | All AI-created markets — live odds from betting pool |
| `/markets/[id]` | Market detail + bet YES/NO + pool stats + claim winnings |
| `/ai` | Autonomous pipeline viz + real stats from chain |
| `/activity` | On-chain event log — every AI action visible |
| `/faucet` | Get 0.1 STT + 1,000 SUSD for testing |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Solidity 0.8.30, Hardhat, Somnia Reactivity SDK |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui |
| Wallet | wagmi 2.x, RainbowKit 2.x, viem |
| Bot | Node.js + ethers.js, PM2, 5 HD wallets |
| Chain | Somnia Testnet (50312), 101ms blocks, native AI primitives |

## Deployed Contracts

| Contract | Address | Role |
|----------|---------|------|
| SantioraV5 | `0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8` | LLM orchestrator + markets |
| SantioraReactiveV5 | deployed on Somnia Reactive | Autonomous scheduler |
| V5Prompts | `0xb344711637890fd11c92C61a730Bd80bA669b881` | On-chain prompt builder |
| V5BettingPool | `0x5303c2ba485625DC9eE5A55c6f5e17B2Cf7426C3` | Parimutuel betting pool |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Betting stablecoin |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia AI execution layer |

## Somnia Agentic Primitives Used

All four Somnia-exclusive primitives are used natively:

1. **`inferToolsChat`** — LLM decides which tools to call, yields tool_calls, resumes with results. Powers both market creation and resolution.
2. **`fetchString` / `fetchUint`** — JSON API tool calls. LLM uses these to fetch real-world data (prices, news, scores) before making decisions.
3. **`scheduleSubscriptionAtBlock`** — ReactiveV5 fires create/resolve loops at exact block numbers. Self-rescheduling from inside the callback.
4. **Consensus layer validators** — Every agent call goes through 3-validator subcommittee. Deterministic, verifiable, no single point of failure.

## Quick Start

```bash
# Clone
git clone https://github.com/[your-repo]/santiora

# Frontend
cd frontend && npm install && npm run dev

# Contracts
cd contracts && npm install && npx hardhat compile

# Deploy V5 betting pool
cd contracts && npx hardhat run scripts/deploy-v5-betting-pool.ts --network somnia

# Setup & fund bot wallets
npx hardhat run scripts/setup-bots.ts --network somnia
npx hardhat run scripts/mint-susd-bots.ts --network somnia

# Run bot trader (or via PM2)
npx ts-node scripts/bot-trader.ts
```

## Environment Variables

```bash
# contracts/.env
WALLET_PRIVATE_KEY=0x...
SOMNIA_RPC=https://dream-rpc.somnia.network

# frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
NEXT_PUBLIC_WALLETCONNECT_ID=your-project-id
```

## License

MIT
