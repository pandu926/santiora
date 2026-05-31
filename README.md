# Santiora

**Fully Autonomous AI Prediction Market Protocol on Somnia Agentic L1**

[![Live](https://img.shields.io/badge/demo-live-brightgreen)](https://santiora.rbexp.com)
[![Chain](https://img.shields.io/badge/chain-Somnia%20Testnet-purple)](https://shannon-explorer.somnia.network)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Overview

Santiora is a prediction market protocol with **zero human operation**. AI agents autonomously create markets, set odds, resolve outcomes through multi-agent verification, and settle bets. No admin keys, no governance, no team operation.

Built exclusively on Somnia Agentic L1, leveraging on-chain AI primitives (`inferToolsChat`, `scheduleSubscriptionAtBlock`, Native Reactivity) that are impossible on any other blockchain.

## Live Demo

https://santiora.rbexp.com — Somnia Testnet (Chain ID: 50312)

## Architecture

```
SantioraReactiveV2 (Scheduler — scheduleSubscriptionAtBlock)
    │
    ├── Create loop: fires every 30 min → FinalV2.createMarket()
    │                                        └── inferToolsChat → LLM generates market
    │
    └── Resolve loop: fires every 30 min → FinalV2.autoResolveExpired()
                                              ├── JSON API Agent → fetch data
                                              ├── LLM Resolver → interpret outcome
                                              └── LLM Verifier → cross-check (agent-to-agent)
```

**Gas efficiency:** 96 fires/day, ~0.5 STT/day. 40 STT sustains 80+ days of autonomous operation.

## Project Structure

```
santiora/
├── contracts/           # Solidity smart contracts (Hardhat)
│   └── src/agents/      # AI agent contracts
├── frontend/            # Next.js 15 application
│   └── src/
│       ├── app/(app)/   # Routes (markets, AI dashboard, docs, etc.)
│       ├── hooks/       # React hooks (betting, market data)
│       └── lib/         # On-chain data, config, ABIs
└── docs/                # Technical documentation (10 pages)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Git

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
```

### Production

```bash
cd frontend
npm run build
npm run start
```

## Core Contracts

| Contract | Address | Role |
|----------|---------|------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` | AI brain — creates/resolves markets via inferToolsChat |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` | Autonomous scheduler — one-shot block triggers |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` | On-chain market index |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Betting stablecoin |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Test tokens (0.1 STT + 1000 SUSD) |

## Somnia Primitives Used

| Primitive | Usage |
|-----------|-------|
| `inferToolsChat` | LLM generates market questions, resolves outcomes on-chain |
| `scheduleSubscriptionAtBlock` | Gas-efficient one-shot triggers (3000x cheaper than BlockTick) |
| Native Reactivity | Validator-guaranteed callbacks, no external keepers |
| Agent Platform | On-chain AI execution (Qwen3-30B) |
| Agent-to-Agent | Resolver + Verifier independent cross-check |

## Documentation

Full technical docs available at `/docs` in the frontend, or in the `docs/` directory:

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Reactivity System](docs/reactivity.md)
- [AI Agents](docs/ai-agents.md)
- [Smart Contracts](docs/smart-contracts.md)
- [Betting Flow](docs/betting-flow.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Solidity 0.8.30, Hardhat |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind 4 |
| Wallet | wagmi 2.x, RainbowKit 2.x, viem |
| UI | shadcn/ui, Framer Motion, Lightweight Charts |
| Chain | Somnia Testnet (50312), 400ms blocks |

## License

MIT
