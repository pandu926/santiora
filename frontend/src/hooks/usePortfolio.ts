"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { PREDICTION_MARKET_SUSD_ABI } from "@/lib/abi/PredictionMarketSUSD";
import { SHARE_TOKEN_ABI } from "@/lib/abi/ShareToken";
import { fetchMarkets, type MarketResponse } from "@/lib/api";

export interface PortfolioPosition {
  marketAddress: string;
  question: string;
  category: string;
  side: "YES" | "NO";
  shares: string;
  sharesRaw: bigint;
  currentValue: string;
  pnl: string;
  pnlPercent: number;
  isProfit: boolean;
  status: number;
  outcome: boolean | null;
  canClaim: boolean;
}

export interface PortfolioSummary {
  totalInvested: string;
  totalCurrentValue: string;
  totalPnl: string;
  totalPnlPercent: number;
  isProfit: boolean;
  winRate: string;
  positionCount: number;
}

interface UsePortfolioReturn {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
  isLoading: boolean;
  error: string | null;
  claimWinnings: (marketAddress: string) => void;
  claimState: "idle" | "pending" | "confirming" | "confirmed" | "error";
  claimError: string | null;
  claimTxHash: `0x${string}` | undefined;
  refetch: () => void;
}

const SUSD_DECIMALS = 18;

function calculateOddsFromSupply(yesSupply: bigint, noSupply: bigint): { yesOdds: number; noOdds: number } {
  const total = yesSupply + noSupply;
  if (total === 0n) return { yesOdds: 50, noOdds: 50 };
  const yesOdds = Number((yesSupply * 100n) / total);
  return { yesOdds, noOdds: 100 - yesOdds };
}

export function usePortfolio(): UsePortfolioReturn {
  const { address: userAddress } = useAccount();
  const [markets, setMarkets] = useState<MarketResponse[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [claimingMarket, setClaimingMarket] = useState<string | null>(null);

  // Fetch all markets from backend API
  const loadMarkets = useCallback(async () => {
    try {
      setMarketsLoading(true);
      const data = await fetchMarkets({ limit: 100 });
      setMarkets(data);
      setMarketsError(null);
    } catch (err: unknown) {
      setMarketsError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Step 1: Read yesToken and noToken addresses for all markets
  const tokenAddressContracts = useMemo(() => {
    return markets.flatMap((m) => [
      {
        address: m.address as `0x${string}`,
        abi: PREDICTION_MARKET_SUSD_ABI,
        functionName: "yesToken" as const,
      },
      {
        address: m.address as `0x${string}`,
        abi: PREDICTION_MARKET_SUSD_ABI,
        functionName: "noToken" as const,
      },
    ]);
  }, [markets]);

  const { data: tokenAddressResults, isLoading: tokenAddrsLoading } = useReadContracts({
    contracts: tokenAddressContracts,
    query: { enabled: markets.length > 0 && !!userAddress },
  });

  // Step 2: Read balanceOf(user) for each YES and NO token
  const balanceContracts = useMemo(() => {
    if (!tokenAddressResults || !userAddress) return [];

    const contracts: Array<{
      address: `0x${string}`;
      abi: typeof SHARE_TOKEN_ABI;
      functionName: "balanceOf";
      args: [`0x${string}`];
    }> = [];

    for (let i = 0; i < tokenAddressResults.length; i += 2) {
      const yesResult = tokenAddressResults[i];
      const noResult = tokenAddressResults[i + 1];

      const yesAddr = yesResult?.status === "success" ? (yesResult.result as `0x${string}`) : null;
      const noAddr = noResult?.status === "success" ? (noResult.result as `0x${string}`) : null;

      if (yesAddr) {
        contracts.push({
          address: yesAddr,
          abi: SHARE_TOKEN_ABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
      }
      if (noAddr) {
        contracts.push({
          address: noAddr,
          abi: SHARE_TOKEN_ABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
      }
    }

    return contracts;
  }, [tokenAddressResults, userAddress]);

  const { data: balanceResults, isLoading: balancesLoading, refetch: refetchBalances } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: balanceContracts.length > 0 },
  });

  // Step 3: Build positions from balance data
  const positions: PortfolioPosition[] = useMemo(() => {
    if (!balanceResults || !tokenAddressResults || markets.length === 0) return [];

    const result: PortfolioPosition[] = [];
    let balanceIdx = 0;

    for (let marketIdx = 0; marketIdx < markets.length; marketIdx++) {
      const market = markets[marketIdx];
      const yesTokenResult = tokenAddressResults[marketIdx * 2];
      const noTokenResult = tokenAddressResults[marketIdx * 2 + 1];

      const hasYesToken = yesTokenResult?.status === "success";
      const hasNoToken = noTokenResult?.status === "success";

      let yesBalance = 0n;
      let noBalance = 0n;

      if (hasYesToken) {
        const balResult = balanceResults[balanceIdx];
        yesBalance = balResult?.status === "success" ? (balResult.result as bigint) : 0n;
        balanceIdx++;
      }
      if (hasNoToken) {
        const balResult = balanceResults[balanceIdx];
        noBalance = balResult?.status === "success" ? (balResult.result as bigint) : 0n;
        balanceIdx++;
      }

      // Calculate odds from supply data
      const yesSupply = BigInt(market.yes_supply || "0");
      const noSupply = BigInt(market.no_supply || "0");
      const { yesOdds, noOdds } = calculateOddsFromSupply(yesSupply, noSupply);

      const isResolved = market.status >= 3;

      // Add YES position if balance > 0
      if (yesBalance > 0n) {
        const shares = Number(formatUnits(yesBalance, SUSD_DECIMALS));
        const pricePerShare = yesOdds / 100;
        const currentValue = shares * pricePerShare;
        const pnl = currentValue - shares;
        const pnlPercent = shares > 0 ? (pnl / shares) * 100 : 0;
        const canClaim = isResolved && market.outcome === true;

        result.push({
          marketAddress: market.address,
          question: market.question,
          category: market.category,
          side: "YES",
          shares: shares.toFixed(2),
          sharesRaw: yesBalance,
          currentValue: currentValue.toFixed(2),
          pnl: pnl.toFixed(2),
          pnlPercent,
          isProfit: pnl >= 0,
          status: market.status,
          outcome: market.outcome,
          canClaim,
        });
      }

      // Add NO position if balance > 0
      if (noBalance > 0n) {
        const shares = Number(formatUnits(noBalance, SUSD_DECIMALS));
        const pricePerShare = noOdds / 100;
        const currentValue = shares * pricePerShare;
        const pnl = currentValue - shares;
        const pnlPercent = shares > 0 ? (pnl / shares) * 100 : 0;
        const canClaim = isResolved && market.outcome === false;

        result.push({
          marketAddress: market.address,
          question: market.question,
          category: market.category,
          side: "NO",
          shares: shares.toFixed(2),
          sharesRaw: noBalance,
          currentValue: currentValue.toFixed(2),
          pnl: pnl.toFixed(2),
          pnlPercent,
          isProfit: pnl >= 0,
          status: market.status,
          outcome: market.outcome,
          canClaim,
        });
      }
    }

    return result;
  }, [balanceResults, tokenAddressResults, markets]);

  // Step 4: Calculate summary metrics
  const summary: PortfolioSummary = useMemo(() => {
    if (positions.length === 0) {
      return {
        totalInvested: "0.00",
        totalCurrentValue: "0.00",
        totalPnl: "0.00",
        totalPnlPercent: 0,
        isProfit: true,
        winRate: "0.0",
        positionCount: 0,
      };
    }

    let totalShares = 0;
    let totalValue = 0;
    let resolvedWins = 0;
    let resolvedTotal = 0;

    for (const pos of positions) {
      totalShares += Number(pos.shares);
      totalValue += Number(pos.currentValue);

      // Count wins for resolved markets
      if (pos.status >= 3) {
        resolvedTotal++;
        if (pos.canClaim) {
          resolvedWins++;
        }
      }
    }

    const totalPnl = totalValue - totalShares;
    const totalPnlPercent = totalShares > 0 ? (totalPnl / totalShares) * 100 : 0;
    const winRate = resolvedTotal > 0 ? (resolvedWins / resolvedTotal) * 100 : 0;

    return {
      totalInvested: totalShares.toFixed(2),
      totalCurrentValue: totalValue.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      totalPnlPercent,
      isProfit: totalPnl >= 0,
      winRate: winRate.toFixed(1),
      positionCount: positions.length,
    };
  }, [positions]);

  // Step 5: Claim winnings (redeem) for resolved markets
  const { writeContract, data: claimHash, isPending: claimPending, error: claimWriteError } = useWriteContract();

  const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  const claimWinnings = useCallback(
    (marketAddress: string) => {
      setClaimingMarket(marketAddress);
      writeContract({
        address: marketAddress as `0x${string}`,
        abi: PREDICTION_MARKET_SUSD_ABI,
        functionName: "redeem",
        gas: 10_000_000n,
      });
    },
    [writeContract]
  );

  const claimState = useMemo(() => {
    if (claimConfirmed) return "confirmed" as const;
    if (claimConfirming) return "confirming" as const;
    if (claimPending) return "pending" as const;
    if (claimWriteError) return "error" as const;
    return "idle" as const;
  }, [claimConfirmed, claimConfirming, claimPending, claimWriteError]);

  const claimError = claimWriteError
    ? claimWriteError.message.length > 100
      ? claimWriteError.message.slice(0, 100) + "..."
      : claimWriteError.message
    : null;

  const isLoading = marketsLoading || tokenAddrsLoading || balancesLoading;

  const refetch = useCallback(() => {
    loadMarkets();
    refetchBalances();
  }, [loadMarkets, refetchBalances]);

  return {
    positions,
    summary,
    isLoading,
    error: marketsError,
    claimWinnings,
    claimState,
    claimError,
    claimTxHash: claimHash,
    refetch,
  };
}
