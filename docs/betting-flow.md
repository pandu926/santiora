# Betting Flow

End-to-end lifecycle of a bet on Santiora: from placing a bet to claiming winnings.

## Overview

```
User connects wallet
    │
    ▼
Browse markets (MarketRegistry.getMarket)
    │
    ▼
Select market → Market Detail page
    │
    ▼
Choose YES or NO, enter amount
    │
    ▼
Step 1: SUSD.approve(marketAddress, amount)     [5M gas on Somnia]
    │
    ▼
Step 2: market.buyYes(amount) or buyNo(amount)  [5M gas on Somnia]
    │
    ▼
ShareToken minted to user (YES or NO ERC20)
    │
    ▼
... wait for market resolution ...
    │
    ▼
Step 3: market.claimWinnings()                  [if user holds winning side]
    │
    ▼
SUSD transferred to user (proportional payout)
```

## Step 1: Approve SUSD

Before betting, the market contract needs permission to transfer SUSD from the user.

```typescript
import { parseUnits } from "viem";

const amount = parseUnits("100", 18); // 100 SUSD

const hash = await walletClient.writeContract({
  address: SUSD_ADDRESS,
  abi: [
    {
      type: "function",
      name: "approve",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
    },
  ],
  functionName: "approve",
  args: [marketAddress, amount],
  gas: 5_000_000n, // Required on Somnia
});

await publicClient.waitForTransactionReceipt({ hash });
```

**Important:** Somnia requires 5M gas for ERC20 `approve`. Standard 50K gas will revert silently (allowance stays 0, subsequent bet reverts).

## Step 2: Place Bet

```typescript
const hash = await walletClient.writeContract({
  address: marketAddress,
  abi: [
    {
      type: "function",
      name: "buyYes", // or "buyNo"
      inputs: [{ name: "amount", type: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
  ],
  functionName: "buyYes",
  args: [amount],
  gas: 5_000_000n,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

After this transaction:
- SUSD is transferred from user to market contract
- YES (or NO) ShareToken is minted to user
- Market odds update based on new supply ratio

## Step 3: Claim Winnings

After the market resolves, winners can claim their proportional share of the total collateral.

```typescript
const hash = await walletClient.writeContract({
  address: marketAddress,
  abi: [
    {
      type: "function",
      name: "claimWinnings",
      inputs: [],
      outputs: [],
      stateMutability: "nonpayable",
    },
  ],
  functionName: "claimWinnings",
  gas: 500_000n,
});
```

### Payout Formula

```
payout = (userShares / totalWinningShares) × totalCollateral
profit = payout - originalBetAmount
```

Example:
- User bets 50 SUSD on YES
- Total YES supply: 200 SUSD worth of shares
- Total NO supply: 300 SUSD worth of shares
- Total collateral: 500 SUSD
- Market resolves YES
- User payout: (50 / 200) × 500 = 125 SUSD
- Profit: 125 - 50 = 75 SUSD

## Market States and User Actions

| Market Status | Can Bet? | Can Claim? | UI State |
|---------------|----------|------------|----------|
| Created (0) | No | No | "Pending" — waiting for AI |
| Active (1) | Yes | No | Betting panel visible |
| Resolving (2) | No | No | "Resolving..." spinner |
| Resolved (3) | No | Yes | Outcome shown, claim button |
| Settled (4) | No | No | "Settled" — all claimed |
| Failed (5) | No | Refund | "Failed" — refund available |

## Frontend Implementation

The betting flow is implemented in `src/hooks/usePlaceBet.ts`:

```typescript
type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

function usePlaceBet(marketAddress: string, onSuccess: () => void) {
  const [state, setState] = useState<BetState>("idle");

  async function placeBet({ isYes, amount }: { isYes: boolean; amount: bigint }) {
    setState("approving");

    // Step 1: Approve
    const approveHash = await writeContract({
      address: SUSD_ADDRESS,
      functionName: "approve",
      args: [marketAddress, amount],
      gas: 5_000_000n,
    });
    await waitForReceipt(approveHash);

    // Step 2: Buy
    setState("betting");
    const buyHash = await writeContract({
      address: marketAddress,
      functionName: isYes ? "buyYes" : "buyNo",
      args: [amount],
      gas: 5_000_000n,
    });
    await waitForReceipt(buyHash);

    setState("confirmed");
    onSuccess(); // Refetch market data
  }

  return { placeBet, state };
}
```

## Odds Calculation

Odds are derived from the share token supply ratio:

```typescript
const yesPercent = totalSupply > 0n
  ? Number((yesSupply * 100n) / (yesSupply + noSupply))
  : 50;
const noPercent = 100 - yesPercent;
```

When a user buys YES tokens, `yesSupply` increases, pushing YES odds up and NO odds down. This creates a natural price discovery mechanism.

## Potential Payout Display

Before placing a bet, the UI shows expected payout:

```typescript
const potentialPayout = amount / (odds / 100);
// If odds are 60% and you bet 100 SUSD:
// payout = 100 / 0.60 = 166.67 SUSD
// profit = 66.67 SUSD
```

## Error Handling

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `0xfb8f41b2` | Approve failed (allowance = 0) | Use 5M gas for approve |
| "insufficient balance" | User doesn't have enough SUSD | Check balance before bet |
| "market not active" | Market already resolved or expired | Disable bet button |
| "transfer failed" | SUSD transfer reverted | Check approval amount |

### Checking Balance Before Bet

```typescript
const balance = await publicClient.readContract({
  address: SUSD_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [userAddress],
});

const canBet = balance >= betAmount;
```

## Proven End-to-End

The full cycle has been tested on-chain:

```
1. Approve 50 SUSD → TX success (5M gas)
2. buyYes(50 SUSD) → TX success, YES tokens minted
3. Market resolved YES (95% confidence via agent-to-agent)
4. claimWinnings() → 123.125 SUSD received
5. Profit: +73.125 SUSD
```

Transaction hashes available on Somnia Explorer for verification.
