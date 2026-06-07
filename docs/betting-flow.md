# Betting Flow (V5)

End-to-end lifecycle of a bet on Santiora V5: from browsing AI-created markets to placing bets and claiming winnings on Somnia Testnet.

## Market Lifecycle

```
Created (0) ──► Active (1) ──► Resolving (2) ──► Resolved (3) ──► Settled (4)
     │                                                  │
     └──► Failed (5)                                    └──► Failed (5)
              (AI returned error/UNRESOLVABLE)                (resolution confidence < 70)
```

| Status | Code | Can Bet? | Description |
|--------|------|----------|-------------|
| Created | 0 | No | AI is forming the market — fetching data, generating odds, drafting the question |
| Active | 1 | Yes | Market is live. Users can place YES/NO bets until the deadline |
| Resolving | 2 | No | AI is gathering real-world data to determine outcome. Bets are locked |
| Resolved | 3 | No, claim only | Outcome determined (YES or NO). Winners can redeem their share tokens |
| Settled | 4 | No | All payouts have been claimed. Market is closed |
| Failed | 5 | No | AI could not resolve (confidence < 70% or UNRESOLVABLE). Refunds may be available |

## How AI Creates Markets

Santiora V5 markets are created autonomously by AI agents that:

1. **Scan news sources** for trending events (sports, crypto, finance, technology)
2. **Fetch real data** via API agents (prices, scores, metrics)
3. **Analyze probability** using LLM inference — outputs odds as a percentage (1-99 = YES probability)
4. **Deploy market** with question, odds, deadline, category, and source URL stored on-chain

Each market on the `SantioraV5` contract returns this tuple from `markets(uint256)`:

| Field | Type | Example |
|-------|------|---------|
| question | string | "Will BTC exceed $100,000 by end of June 2026?" |
| odds | uint256 | 65 (YES probability = 65%) |
| deadline | uint256 | 1717200000 (unix timestamp) |
| category | string | "crypto" |
| status | uint8 | 1 (Active) |
| outcome | string | "YES" / "NO" / "" (unresolved) |
| confidence | uint256 | 85 (AI resolution confidence %) |
| createdAt | uint256 | 1717000000 (unix timestamp) |
| sourceUrl | string | "https://coingecko.com/..." |
| rawResponse | string | Full LLM response JSON |

## Betting Flow Overview

```
User connects wallet (RainbowKit)
    │
    ▼
Browse markets (SantioraV5.marketCount() + SantioraV5.markets(i))
    │
    ▼
Select market → /markets/{address}
    │
    ▼
Choose YES or NO, enter SUSD amount
    │
    ▼
Step 1: SUSD.approve(SantioraV5, amount)       [5,000,000 gas on Somnia]
    │
    ▼
Step 2: SantioraV5.bet(isYes, amount)          [10,000,000 gas on Somnia]
    │
    ▼
YES or NO share tokens minted to user
    │
    ▼
... wait for market resolution ...
    │
    ▼
Step 3: market.redeem()                        [if user holds winning side]
    │
    ▼
SUSD transferred to user (proportional payout)
```

## Step 1: Approve SUSD

The SantioraV5 contract needs permission to transfer SUSD from your wallet before you can bet.

```typescript
import { parseUnits } from "viem";
import { SUSD_ADDRESS, SUSD_ABI } from "@/lib/abi/SUSD";

const amount = parseUnits("100", 18); // 100 SUSD

const hash = await writeContractAsync({
  address: SUSD_ADDRESS,
  abi: SUSD_ABI,
  functionName: "approve",
  args: [SANTIORA_V5, amount],
  gas: 5_000_000n, // REQUIRED on Somnia — 50K will revert
});
```

**Important:** Somnia requires 5M gas for ERC20 `approve`. Standard 50K gas will revert silently — the allowance stays 0 and subsequent `bet()` calls fail.

## Step 2: Place Bet

```typescript
const hash = await writeContractAsync({
  address: SANTIORA_V5,
  abi: PREDICTION_MARKET_SUSD_ABI,
  functionName: "bet",
  args: [true, amount], // true = YES bet, false = NO bet
  gas: 10_000_000n,
});
```

After this transaction:
- SUSD is transferred from your wallet to SantioraV5
- YES (or NO) share tokens (ERC-20) are minted to your wallet
- Market odds update based on the new supply ratio

## Step 3: Claim Winnings After Resolution

Once a market resolves to YES or NO, winners call `redeem()` to exchange their winning share tokens for SUSD:

```typescript
const hash = await writeContractAsync({
  address: SANTIORA_V5,
  abi: PREDICTION_MARKET_SUSD_ABI,
  functionName: "redeem",
  args: [marketId],
});
```

### Payout Formula

```
payout = (yourWinningShares / totalWinningShares) x totalSUSDCollateral
profit = payout - originalBetAmount
```

Example:
- You bet 50 SUSD on YES in market #3
- Total YES shares minted: 200 (worth of SUSD)
- Total NO shares minted: 300 (worth of SUSD)
- Total SUSD in the market: 500
- Market resolves YES
- Your payout: (50 / 200) x 500 = 125 SUSD
- Profit: 125 - 50 = 75 SUSD

## Odds and AI Price Setting

### Initial Odds

Odds are set by the AI when the market is created (stored in the `odds` field). The value is 1-99 representing the AI's estimated YES probability. Higher odds = AI is more confident the event will happen.

### Live Odds from Supply Ratio

Once betting begins, odds drift from the AI's initial estimate toward the market consensus:

```typescript
// Calculated from share token supply ratio
const yesSupply = await shareToken("yes").totalSupply();
const noSupply = await shareToken("no").totalSupply();
const total = yesSupply + noSupply;
const yesOdds = total > 0n ? Number((yesSupply * 100n) / total) : initialOdds;
const noOdds = 100 - yesOdds;
```

When users buy YES tokens, `yesSupply` increases, pushing YES odds up and NO odds down. This mirrors how traditional prediction markets achieve price discovery.

### Potential Payout Display

Before placing a bet, the frontend calculates expected payout:

```typescript
const odds = betSide === "yes" ? yesOdds : noOdds;
const potentialPayout = betAmount / (odds / 100);
// If odds are 60% and you bet 100 SUSD:
// payout = 100 / 0.60 = 166.67 SUSD (profit = 66.67 SUSD)
```

## AI Resolution

### Resolution Process

1. **Deadline reached** — market moves to Resolving (status 2)
2. **AI fetches current data** from the original source URL (or the web scraper agent)
3. **LLM analyzes** the data against the market question
4. **Deterministic consensus** — three AI validators evaluate and must agree
5. **Confidence threshold** — confidence must be >= 70% to resolve
6. **Final outcome** — returns YES, NO, or UNRESOLVABLE

### What Determines YES/NO

- **YES** — AI confidence >= 70% that the event described in the question occurred
- **NO** — AI confidence >= 70% that the event did NOT occur
- **UNRESOLVABLE / revert to Active** — confidence < 70% (insufficient data, ambiguous outcome, or deadline not yet passed)

The `rawResponse` field on the market stores the full LLM response for transparency.

## Yield and Resume Resolution

### Stuck Markets

If a market reverted to Active because the AI could not resolve it (confidence < 70%), the system:

1. **Waits** for the next resolution cycle
2. **Re-fetches** the source data — new data may have become available
3. **Retries** the LLM analysis with fresh context
4. **Hits a retry cap** — after max retries, the market is marked Failed (5)

### Unresolved Market Edge Cases

- **Expired but unresolved**: If a market's deadline passes but it is still in Active state, it displays as "Expired" in the frontend with a note "awaiting AI resolution". No new bets are accepted.
- **Insufficient data**: If the source URL is down or returns empty data, the market stays unresolvable until data becomes available.
- **STT balance**: The SantioraV5 contract needs STT to pay for agent calls. If balance is too low, resolution calls fail.

## Frontend Implementation

The betting flow is implemented in `src/hooks/usePlaceBet.ts` as a state machine:

```typescript
type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

function usePlaceBet(marketAddress: string, onSuccess?: () => void) {
  // Step 1: Check SUSD allowance. If insufficient, sign an approve TX (5M gas)
  // Step 2: Call SantioraV5.bet(isYes, amount) with 10M gas
  // Step 3: Wait for TX receipt, refetch market data
}
```

The market detail page (`src/app/(app)/markets/[address]/page.tsx`) polls every 30 seconds for live odds updates and shows:
- Current YES/NO odds with a visual probability bar
- Countdown timer to deadline
- Potential payout before bet
- Transaction confirmation with explorer link
- Market info: volume, fee, creation date, deadline
- AI resolution panel showing agent pipeline status

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| Approve TX succeeds but bet reverts | Approve used < 5M gas — allowance not set | Re-approve with 5,000,000 gas |
| "insufficient balance" | Not enough SUSD in wallet | Get SUSD from faucet or lower bet amount |
| "market not active" | Market is Created, Resolving, or Resolved | Only bet on Active (status 1) markets |
| "transfer failed" | SUSD transfer reverted | Check SUSD approval covers the bet amount |
| Wallet rejection | User cancelled the TX in their wallet | No action — wallet UX handles this |

## Contract Addresses (Somnia Testnet 50312)

| Contract | Address |
|----------|---------|
| SantioraV5 | `0x6257d213a59f2278692baBB2eAB24Ddc0700B94B` |
| V5Prompts | `0xa09D48115Ef8E54e2f6625A8892822Faf1f434C7` |
| SUSD (token) | `0xB553c0003C3F0419abD358A2edD16191fC86ef90` |
| Faucet | `0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1` |