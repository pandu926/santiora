# Santiora Demo Video Script
**Duration:** 4 minutes | **Target:** Somnia Hackathon Judges + Demo Engineer Hiring

---

## STRUCTURE OVERVIEW

| Section | Duration | Focus |
|---------|----------|-------|
| Hook + Problem | 0:00–0:30 | Why prediction markets need Somnia |
| Competitor Comparison | 0:30–1:00 | What others CAN'T do |
| Santiora Demo (Core) | 1:00–3:20 | Live product footage |
| Technical Deep Dive | 3:20–3:50 | Architecture + on-chain proof |
| Close | 3:50–4:00 | Summary + CTA |

---

## SECTION 1: HOOK + PROBLEM (0:00–0:30)

### Narration:
"Every prediction market today has the same problem: humans. Humans create markets. Humans resolve them. Humans manage liquidity. What if AI could do ALL of it — not off-chain with APIs, but natively on-chain, with every decision verifiable on the blockchain?"

### Footage:
- Quick montage: Polymarket UI, Augur UI, Gnosis UI (show manual market creation forms)
- Text overlay: "Manual creation. Manual resolution. Centralized oracles."
- Transition: Santiora logo reveal

---

## SECTION 2: COMPETITOR COMPARISON (0:30–1:00)

### Narration:
"On Ethereum, Polymarket uses centralized UMA oracles — humans vote on outcomes. Augur requires manual market creation and resolution bonds. On other L1s, prediction markets still depend on Chainlink keepers, off-chain cron jobs, and centralized API servers.

Somnia changes everything. With native on-chain AI primitives — inferToolsChat, scheduleSubscriptionAtBlock, and the Agent Platform — we can build what's impossible anywhere else: a prediction market that operates itself."

### Footage:
- Split screen comparison table:

| Feature | Polymarket | Augur | Santiora (Somnia) |
|---------|-----------|-------|-------------------|
| Market Creation | Manual (human) | Manual + bond | AI Agent (on-chain LLM) |
| Resolution | UMA oracle (human vote) | Human reporters | Multi-agent AI consensus |
| Automation | Off-chain bots | Keepers (Chainlink) | Native Reactivity (validator-level) |
| Scheduling | Cron server | External keeper | scheduleSubscriptionAtBlock |
| AI Reasoning | None (off-chain) | None | inferToolsChat (on-chain) |
| Trust Model | Trust UMA voters | Trust reporters | Trustless AI verification |

- Highlight: "Only possible on Somnia Agentic L1"

---

## SECTION 3: SANTIORA DEMO — LIVE PRODUCT (1:00–3:20)

### 3A: Markets Page (1:00–1:30)

**Narration:**
"This is Santiora — a fully autonomous prediction market. Every market you see here was created by AI. No human typed these questions. The AI detected trending events, generated verifiable questions, and set initial odds — all through on-chain LLM calls."

**Footage:**
- Open https://santiora.rbexp.com/markets
- Show market cards with badges: "Active", "Resolved", "SUSD"
- Click on an active SUSD market (e.g., Anthropic funding round)
- Show odds, deadline, category
- Point out: "Status filters — Active, Resolved, Expired"
- Point out: "Deduplicated, real on-chain data — no backend database"

### 3B: Betting Flow (1:30–2:00)

**Narration:**
"Users bet with SUSD stablecoin. The flow is simple: choose YES or NO, enter amount, approve, bet. Share tokens are minted as ERC20s. When the market resolves, winners claim proportional payouts — all automated."

**Footage:**
- Click into active SUSD market detail page
- Show betting panel: YES/NO buttons, amount input, potential payout calculation
- Show balance display
- (Optional) Place a small bet to show the 2-step flow: Approve → Bet
- Show transaction confirmation with explorer link

### 3C: AI Resolution — Agent-to-Agent (2:00–2:30)

**Narration:**
"Here's what makes Santiora unique: resolution. When a market expires, the AI doesn't just guess. It runs a 3-agent verification chain — entirely on-chain.

First, a JSON API agent fetches real-world data. Then, an LLM Resolver interprets the outcome. Finally, an independent LLM Verifier cross-checks with a different prompt. If both agents agree — 95% confidence. If they disagree — the market retries or fails safely.

This is agent-to-agent interaction. On-chain. Verifiable. No human in the loop."

**Footage:**
- Open https://santiora.rbexp.com/ai
- Show pipeline visualization: ReactiveV2 → FinalV2 → inferToolsChat → Market
- Show resolve pipeline: Scheduled → Deadline Check → Auto-Resolve → LLM → Verified
- Show stats: createFires, resolveFires, marketsCreated
- Show a resolved market detail with "Resolved with 92% confidence"
- Open Somnia Explorer: show actual agent call transactions (Decision event, BrainResponse event)

### 3D: Autonomous Scheduling — scheduleSubscriptionAtBlock (2:30–3:00)

**Narration:**
"Most protocols use BlockTick — firing every single block. On Somnia at 400ms per block, that's 216,000 callbacks per day. Unsustainable.

Santiora uses scheduleSubscriptionAtBlock — one-shot triggers that fire exactly when needed, then self-reschedule. Result: 96 fires per day instead of 216,000. Gas cost dropped from 112 STT per day to 0.5 STT. A 40 STT deposit sustains 80+ days of fully autonomous operation.

This is the most gas-efficient use of Somnia Reactivity possible."

**Footage:**
- Show AI dashboard stats: "Create Fires: X, Resolve Fires: X"
- Show contract on explorer: ReactiveV2 balance, subscription IDs
- Text overlay comparison:
  - BlockTick: 216,000 callbacks/day → 112 STT/day
  - scheduleSubscriptionAtBlock: 96 callbacks/day → 0.5 STT/day
  - "3000x more efficient"
- Show ScheduledNext event on explorer (proof of self-rescheduling)

### 3E: Activity Log — On-Chain Proof (3:00–3:20)

**Narration:**
"Every action is verifiable. The activity log shows real on-chain events — create fires, resolve fires, agent callbacks, market registrations. Each entry links to a transaction on the Somnia Explorer. Nothing is simulated. Nothing is off-chain."

**Footage:**
- Open https://santiora.rbexp.com/activity
- Scroll through events: "Create Loop Fired", "Brain Response", "Market Registered", "Next Trigger Scheduled"
- Click a TX link → opens Somnia Explorer showing the actual transaction
- Show contract transparency section on AI page

---

## SECTION 4: TECHNICAL ARCHITECTURE (3:20–3:50)

### Narration:
"The architecture is three layers. ReactiveV2 handles scheduling — fires at specific blocks, self-reschedules. FinalV2 is the AI brain — calls inferToolsChat for creation and resolution, implements agent-to-agent verification. The Market layer handles betting mechanics with SUSD collateral and ERC20 share tokens.

Five Somnia primitives used natively: inferToolsChat for LLM reasoning, scheduleSubscriptionAtBlock for gas-efficient automation, Native Reactivity for validator-guaranteed callbacks, the Agent Platform for multi-agent coordination, and agent-to-agent verification for trustless consensus."

**Footage:**
- Show architecture diagram (from docs or AI page):
```
ReactiveV2 (scheduleSubscriptionAtBlock)
    ↓
FinalV2 (inferToolsChat → LLM Agent)
    ↓
MarketRegistry + PredictionMarketSUSD
```
- Show "Somnia Primitives Used" section on AI page
- Quick flash of contract addresses on explorer

---

## SECTION 5: CLOSE (3:50–4:00)

### Narration:
"Santiora. Zero human operation. AI creates, resolves, and settles prediction markets — all natively on Somnia Agentic L1. The future of autonomous DeFi starts here."

**Footage:**
- Santiora logo + URL: santiora.rbexp.com
- Text overlay: "Built on Somnia Agentic L1"
- Badges: "inferToolsChat • scheduleSubscriptionAtBlock • Agent-to-Agent • Native Reactivity"

---

## RECORDING TIPS

### Screen Recording Order:
1. Markets page (grid view, scroll through)
2. Market detail (active SUSD market with betting panel)
3. Place a bet (if possible, or show the flow)
4. Resolved market detail (show 100%/0% outcome)
5. AI Dashboard (pipeline + stats + contracts)
6. Activity page (scroll through real events, click TX link)
7. Somnia Explorer (show actual transactions)
8. Docs page (quick flash to show professionalism)

### Key Moments to Emphasize:
- "Created by AI" — no human typed these questions
- "Resolved by AI consensus" — agent-to-agent verification
- "scheduleSubscriptionAtBlock" — say it, show it, explain why it matters
- "0.5 STT/day" — sustainable autonomous operation
- "Every action on-chain" — click TX links to prove it

### Tone:
- Confident, technical, concise
- Not salesy — let the product speak
- Emphasize "impossible on other chains" at least 2x
- Use specific numbers (92% confidence, 3000x efficiency, 80+ days)

---

## JUDGING CRITERIA MAPPING

| Criteria | How Video Addresses It |
|----------|----------------------|
| Functionality (25%) | Live betting flow, real markets, working resolution |
| Agent-First Design (25%) | inferToolsChat, agent-to-agent, scheduleSubscriptionAtBlock |
| Innovation (25%) | Competitor comparison, "impossible elsewhere", gas efficiency |
| Autonomous Performance (25%) | Self-rescheduling loops, 80+ days sustainability, zero human |
