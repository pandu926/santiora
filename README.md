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

1. **Create markets** — LLM detects trending events, generates verifiable questions, sets initial odds
2. **Resolve outcomes** — Multi-agent verification chain (Resolver + Verifier consensus)
3. **Self-schedule** — Validator-guaranteed triggers at specific blocks, zero external infrastructure
4. **Settle bets** — Winners claim proportional payouts automatically

No admin keys. No governance. No team operation. **AI IS the protocol operator.**

## Why Somnia?

Santiora is **impossible on any other blockchain.** Here's why:

| Somnia Primitive | What It Does | Why No Other Chain Has It |
|-----------------|-------------|--------------------------|
| `inferToolsChat` | On-chain LLM inference (Qwen3-30B) | Other chains require off-chain APIs for AI |
| `scheduleSubscriptionAtBlock` | One-shot block triggers, self-rescheduling | Others use Chainlink Keepers or cron servers |
| Native Reactivity | Validator-guaranteed callbacks | Others depend on external relayer networks |
| Agent Platform | Multi-agent coordination on-chain | Others can't orchestrate agents natively |
| 400ms blocks | Sub-second finality | Enables real-time market operations |

**On Ethereum:** You'd need Chainlink Keepers ($$$), off-chain AI APIs (centralized), UMA oracle (human voters), and a server running 24/7.

**On Somnia:** Everything runs natively at the validator level. Zero external dependencies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCHEDULING LAYER                             │
│                                                                  │
│  SantioraReactiveV2                                             │
│  Uses scheduleSubscriptionAtBlock — fires exactly when needed   │
│  Self-reschedules from within callback                          │
│  96 fires/day | 0.5 STT/day | 40 STT lasts 80+ days           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BRAIN LAYER                               │
│                                                                  │
│  SantioraFinalV2 — AI Brain                                    │
│  ├── createMarket() → inferToolsChat → LLM generates market    │
│  └── autoResolveExpired() → 3-Agent Verification Chain:         │
│       ├── JSON API Agent → fetch real-world data                │
│       ├── LLM Resolver → interpret outcome                      │
│       └── LLM Verifier → independent cross-check               │
│           Match = 95% confidence | Mismatch = retry/fail        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MARKET LAYER                               │
│                                                                  │
│  MarketRegistry — on-chain index of all markets                 │
│  PredictionMarketSUSD — betting with ERC20 share tokens         │
│  Users: bet YES/NO → market resolves → winners claim payout     │
└─────────────────────────────────────────────────────────────────┘
```

## Autonomous Workflow

```
Every 30 minutes (self-scheduled, no external trigger):

CREATE LOOP:
  Block N fires → ReactiveV2._onEvent()
    → FinalV2.createMarket("technology")
      → inferToolsChat(LLM_AGENT_ID, "Generate prediction market...")
        → Qwen3-30B returns: { question, odds, deadline, category }
          → Market registered on-chain
    → ReactiveV2 schedules next fire at Block N+4500

RESOLVE LOOP:
  Block M fires → ReactiveV2._onEvent()
    → Scan all markets where deadline < now
      → FinalV2.autoResolveExpired(marketId)
        → JSON API Agent fetches real-world data
          → LLM Resolver interprets: "Based on data, outcome is NO"
            → LLM Verifier cross-checks: "I independently confirm NO"
              → Both agree → 95% confidence → Market resolved
    → ReactiveV2 schedules next fire at Block M+4500
```

## Gas Efficiency: 3000x Improvement

| Approach | Callbacks/Day | Cost/Day | 40 STT Lasts |
|----------|--------------|----------|--------------|
| BlockTick (every block) | 216,000 | ~112 STT | 9 hours |
| **scheduleSubscriptionAtBlock** | **96** | **~0.5 STT** | **80+ days** |

Most protocols waste gas polling every block. Santiora fires **only when work is needed**, then self-reschedules. Zero idle gas.

## Vision

A world where DeFi protocols operate themselves. No teams managing operations. No governance votes to resolve disputes. No centralized oracles deciding outcomes.

Santiora proves this is possible today — not as a concept, but as a **live, working protocol** creating and resolving markets every 30 minutes with zero human intervention.

## Proven On-Chain

All claims are verifiable on Somnia Explorer:

- **Markets created autonomously:** 15+ (and counting every 30 min)
- **Markets resolved by AI consensus:** 5+ with 85-95% confidence
- **Agent-to-agent verification:** Resolver + Verifier cross-check proven
- **Self-rescheduling:** Subscription IDs change after each fire (proof of perpetuation)
- **Gas efficiency:** 0.005 STT per fire average

## Live Demo

**https://santiora.rbexp.com**

| Page | What It Shows |
|------|--------------|
| `/markets` | All AI-created markets (active, resolved, expired) |
| `/markets/[addr]` | Market detail + betting (SUSD markets) |
| `/ai` | Autonomous pipeline visualization + real-time stats |
| `/activity` | On-chain event log (every action = verifiable TX) |
| `/docs` | Full technical documentation |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Solidity 0.8.30, Hardhat, Somnia Reactivity SDK |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind 4, shadcn/ui |
| Wallet | wagmi 2.x, RainbowKit 2.x, viem |
| Chain | Somnia Testnet (50312), 400ms blocks, native AI primitives |

## Deployed Contracts

| Contract | Address | Role |
|----------|---------|------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` | AI brain |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` | Autonomous scheduler |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` | Market index |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Betting stablecoin |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia AI execution |

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Contracts
cd contracts && npm install && npx hardhat compile
```

## Documentation

Full technical docs at `/docs` in the app, or in the `docs/` directory:

- [Architecture](docs/architecture.md) — System design and data flow
- [Reactivity System](docs/reactivity.md) — scheduleSubscriptionAtBlock deep dive
- [AI Agents](docs/ai-agents.md) — inferToolsChat and agent-to-agent verification
- [Smart Contracts](docs/smart-contracts.md) — ABI reference and deployment
- [Betting Flow](docs/betting-flow.md) — End-to-end bet lifecycle
- [Deployment](docs/deployment.md) — Deploy your own instance
- [Troubleshooting](docs/troubleshooting.md) — Common issues and fixes

## License

MIT
