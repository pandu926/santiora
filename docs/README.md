# Santiora Documentation

Fully autonomous AI prediction market protocol on Somnia Agentic L1. V5 introduces the yield-and-resume orchestration pattern — the LLM decides what real-world data to fetch, the contract executes it, then the LLM produces the final market or resolution.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started.md) | Setup, configuration, and first deployment |
| [Architecture](./architecture.md) | Yield-and-resume pipeline, state machine, tool routing |
| [Smart Contracts](./smart-contracts.md) | Contract reference, ABIs, deployment addresses |
| [Reactivity System](./reactivity.md) | scheduleSubscriptionAtBlock, gas-efficient automation |
| [AI Agents](./ai-agents.md) | inferToolsChat, JSON API agent, agent-to-agent verification |
| [Frontend](./frontend.md) | Next.js 15 app structure, hooks, on-chain data |
| [Betting Flow](./betting-flow.md) | End-to-end bet lifecycle: approve, bet, resolve, claim |
| [Deployment Guide](./deployment.md) | Contract deployment, funding, configuration |
| [Troubleshooting](./troubleshooting.md) | Common issues, gas estimation, Somnia quirks |

## What Makes Santiora Different

Santiora is not a prediction market with AI features bolted on. It is a protocol where **AI is the operator**. No admin keys, no multisig, no governance votes. The AI agents:

1. **Create markets** — LLM fetches real-world data via on-chain tools, then generates a question with evidence-based odds
2. **Resolve outcomes** — same yield-and-resume pipeline: the LLM fetches current data, compares against the market threshold, and returns YES/NO with a confidence score
3. **Auto-trigger** — Somnia Native Reactivity fires callbacks at scheduled blocks with zero idle gas
4. **Self-perpetuate** — each callback re-schedules the next one automatically via `scheduleSubscriptionAtBlock`

**V5 improvement:** every market costs ~0.72 STT (versus ~2 STT in V4). The yield-and-resume pattern eliminates separate agent calls for data fetching and interpretation — the LLM orchestrates everything in a single pipeline cycle.

## Live Instance

- **Frontend:** https://santiora.rbexp.com
- **Chain:** Somnia Testnet (Chain ID: 50312)
- **RPC:** https://dream-rpc.somnia.network
- **Explorer:** https://shannon-explorer.somnia.network

## Core Contracts (V5)

| Contract | Address | Role |
|----------|---------|------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` | Main orchestrator — creates and resolves markets via yield-and-resume LLM pipeline |
| SantioraReactiveV5 | (deployed) | Autonomous scheduler — fires create/resolve at block intervals |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` | External prompt builder — keeps main contract within size limits |
| MarketRegistry | `0x9e59B7016E3Bc6650d8fb074A58F30C03Fa50677` | On-chain market index and duplicate detection |
| Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | Somnia's native agent execution layer |
| LLM Agent | ID `12847293847561029384` | Qwen3-30B with inferToolsChat — market creation and resolution |
| JSON API Agent | ID `13174292974160097713` | Real-world data fetching — CoinGecko, TheSportsDB, GitHub, arbitrary JSON APIs |
| SUSD | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` | Betting stablecoin |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` | Test tokens (0.1 STT + 1000 SUSD) |

## V5 Contract Modules

V5 splits the protocol across six focused contracts, replacing the monolithic V2 design:

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `SantioraV5.sol` | 371 | Main contract — access control, JSON parsing, market registry, lifecycle finalization |
| `V5Pipeline.sol` | 374 | Yield-and-resume state machine — dispatch, tool execution, resume, replay protection |
| `V5Helpers.sol` | 198 | JSON field extraction, date formatting, string utilities |
| `V5ToolRouter.sol` | 141 | Routes LLM tool calldata to real JSON API URLs and selectors |
| `V5Types.sol` | 131 | Shared types, enums, structs, constants, events |
| `V5Prompts.sol` | 62 | External prompt builder — deployed separately to keep SantioraV5 under the size limit |
| `SantioraReactiveV5.sol` | 232 | Block-based scheduler — create and resolve loops |

## LLM Tools

The LLM has access to 4 on-chain tools, each routed through the JSON API agent to fetch real-world data:

| Tool | Arguments | Data Source | Returns |
|------|-----------|-------------|---------|
| `fetchPrice` | `symbol` (BTC, ETH, SOL...) | CoinGecko API | Current USD price |
| `fetchSportsFixture` | `league` (EPL, NBA, NFL...) | TheSportsDB API | Next upcoming fixture name |
| `fetchHeadline` | `topic` | GitHub search | Top repository name |
| `fetchJSON` | `url`, `selector` | Any JSON API | Arbitrary value via dot-notation path |

## Performance

| Metric | V4 (callback-based) | V5 (yield-and-resume) |
|--------|---------------------|----------------------|
| STT per market | ~2 STT | ~0.72 STT |
| Agent calls per market | 3+ (data fetch, resolver, verifier) | 1 (single yield-and-resume cycle) |
| Cost improvement | — | ~3x cheaper |

The entire system runs on ~0.5 STT/day in base gas. A 40 STT deposit sustains operations for 80+ days.