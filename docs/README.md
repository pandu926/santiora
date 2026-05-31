# Santiora Documentation

Fully autonomous AI prediction market protocol on Somnia Agentic L1.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started.md) | Setup, configuration, and first deployment |
| [Architecture](./architecture.md) | System design, data flow, contract interactions |
| [Smart Contracts](./smart-contracts.md) | Contract reference, ABIs, deployment addresses |
| [Reactivity System](./reactivity.md) | scheduleSubscriptionAtBlock, gas-efficient automation |
| [AI Agents](./ai-agents.md) | inferToolsChat, agent-to-agent verification |
| [Frontend](./frontend.md) | Next.js 15 app structure, hooks, on-chain data |
| [Betting Flow](./betting-flow.md) | End-to-end bet lifecycle: approve → bet → resolve → claim |
| [Deployment Guide](./deployment.md) | Contract deployment, funding, configuration |
| [Troubleshooting](./troubleshooting.md) | Common issues, gas estimation, Somnia quirks |

## What Makes Santiora Different

Santiora is not a prediction market with AI features bolted on. It is a protocol where **AI is the operator**. No admin keys, no multisig, no governance votes. The AI agents:

1. **Create markets** — detect trending events, generate questions, set initial odds
2. **Resolve outcomes** — scrape real-world data, interpret with LLM, verify with independent agent
3. **Auto-trigger** — Somnia Native Reactivity fires callbacks at scheduled blocks
4. **Self-perpetuate** — each callback re-schedules the next one automatically

The entire system runs on ~0.5 STT/day in gas. A 40 STT deposit sustains operations for 80+ days.

## Live Instance

- **Frontend:** https://santiora.rbexp.com
- **Chain:** Somnia Testnet (Chain ID: 50312)
- **RPC:** https://dream-rpc.somnia.network
- **Explorer:** https://shannon-explorer.somnia.network

## Core Contracts (Current)

| Contract | Address | Role |
|----------|---------|------|
| SantioraFinalV2 | `0x699924676bcea563a3171c916a01a4ccafb63ee8` | AI brain — creates and resolves markets via inferToolsChat |
| SantioraReactiveV2 | `0x9a907ccbf539fe98f76f913d6d8c65190b75d248` | Autonomous scheduler — fires create/resolve at intervals |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` | On-chain market index |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia's native agent execution layer |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Betting stablecoin |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Test tokens (0.1 STT + 1000 SUSD) |
