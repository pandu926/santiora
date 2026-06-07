import { useReadContract, useReadContracts } from "wagmi";

const SANTIORA_V5 = "0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8" as const;

const SANTIORA_V5_ABI = [
  {
    name: "marketCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "markets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "question", type: "string" },
      { name: "odds", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "category", type: "string" },
      { name: "status", type: "uint8" },
      { name: "outcome", type: "string" },
      { name: "confidence", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "sourceUrl", type: "string" },
      { name: "rawResponse", type: "string" },
    ],
  },
] as const;

export interface MarketData {
  id: number;
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

export function useMarketCount() {
  return useReadContract({
    address: SANTIORA_V5,
    abi: SANTIORA_V5_ABI,
    functionName: "marketCount",
  });
}

export function useMarkets(offset: number, limit: number) {
  const { data: count, isLoading: countLoading } = useMarketCount();

  const total = count ? Number(count) : 0;
  const start = Math.min(offset, total);
  const end = Math.min(offset + limit, total);
  const indices = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);

  const contracts = indices.map((i) => ({
    address: SANTIORA_V5,
    abi: SANTIORA_V5_ABI,
    functionName: "markets" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: results, isLoading: marketsLoading } = useReadContracts({
    contracts,
    query: { enabled: !countLoading && indices.length > 0 },
  });

  const markets: MarketData[] = (results || [])
    .map((result, i) => {
      if (result.status !== "success" || !result.result) return null;
      const [question, odds, deadline, category, status] = result.result as [
        string,
        bigint,
        bigint,
        string,
        number,
        string,
        bigint,
        bigint,
        string,
        string,
      ];

      return {
        id: start + i,
        address: `${SANTIORA_V5}:${start + i}`,
        question,
        deadline: Number(deadline),
        category,
        status: Number(status),
        totalCollateral: "0",
        yesSupply: 0n,
        noSupply: 0n,
        yesOdds: Number(odds),
      };
    })
    .filter((m): m is MarketData => m !== null);

  return {
    markets,
    isLoading: countLoading || marketsLoading,
    statusLabel: (s: number) => STATUS_LABELS[s as keyof typeof STATUS_LABELS] || "Unknown",
  };
}

export function useMarketInfo(_marketAddress: string | undefined) {
  return { data: null, isLoading: false };
}
