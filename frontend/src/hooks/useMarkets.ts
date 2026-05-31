import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { CONTRACTS } from "@/lib/config";
import { MARKET_FACTORY_ABI } from "@/lib/abi/MarketFactory";
import { PREDICTION_MARKET_ABI } from "@/lib/abi/PredictionMarket";

export interface MarketData {
  address: string;
  question: string;
  deadline: number;
  category: string;
  status: number;
  totalCollateral: string;
  yesSupply: bigint;
  noSupply: bigint;
  yesOdds: number;
}

const STATUS_LABELS = ["Created", "Active", "Resolving", "Resolved", "Settled"] as const;

function categoryFromBytes32(hex: string): string {
  const stripped = hex.replace(/00+$/, "");
  if (stripped === "0x" || stripped === "") return "general";
  try {
    return Buffer.from(stripped.slice(2), "hex").toString("utf8");
  } catch {
    return "general";
  }
}

export function useMarketCount() {
  return useReadContract({
    address: CONTRACTS.MARKET_FACTORY as `0x${string}`,
    abi: MARKET_FACTORY_ABI,
    functionName: "getMarketCount",
  });
}

export function useMarketAddresses(offset: number, limit: number) {
  return useReadContract({
    address: CONTRACTS.MARKET_FACTORY as `0x${string}`,
    abi: MARKET_FACTORY_ABI,
    functionName: "getMarkets",
    args: [BigInt(offset), BigInt(limit)],
  });
}

export function useMarketInfo(marketAddress: string | undefined) {
  return useReadContract({
    address: marketAddress as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketInfo",
    query: { enabled: !!marketAddress },
  });
}

export function useMarkets(offset: number, limit: number) {
  const { data: addresses, isLoading: addressesLoading } = useMarketAddresses(offset, limit);

  const contracts = (addresses || []).map((addr) => ({
    address: addr as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketInfo" as const,
  }));

  const { data: results, isLoading: marketsLoading } = useReadContracts({
    contracts,
    query: { enabled: !!addresses && addresses.length > 0 },
  });

  const markets: MarketData[] = (results || [])
    .map((result, i) => {
      if (result.status !== "success" || !result.result) return null;
      const [question, deadline, cat, status, collateral, yesSupply, noSupply] = result.result as [
        string, bigint, string, number, bigint, bigint, bigint
      ];

      const totalShares = yesSupply + noSupply;
      const yesOdds = totalShares > 0n
        ? Number((yesSupply * 100n) / totalShares)
        : 50;

      return {
        address: (addresses as string[])[i],
        question,
        deadline: Number(deadline),
        category: categoryFromBytes32(cat as string),
        status,
        totalCollateral: formatEther(collateral),
        yesSupply,
        noSupply,
        yesOdds,
      };
    })
    .filter((m): m is MarketData => m !== null);

  return {
    markets,
    isLoading: addressesLoading || marketsLoading,
    statusLabel: (s: number) => STATUS_LABELS[s] || "Unknown",
  };
}
