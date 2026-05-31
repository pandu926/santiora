"use client";

import { useEffect, useState, useCallback } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { PREDICTION_MARKET_SUSD_ABI } from "@/lib/abi/PredictionMarketSUSD";
import { SHARE_TOKEN_ABI } from "@/lib/abi/ShareToken";
import { fetchAllMarkets } from "@/lib/onchain";

export interface MarketDetailData {
  address: string;
  question: string;
  category: string;
  deadline: number;
  status: number;
  totalCollateral: string;
  feePercent: number;
  createdAt: string;
  yesSupply: bigint;
  noSupply: bigint;
  yesOdds: number;
  noOdds: number;
  resolutionConfidence: number | null;
  outcome: boolean | null;
  txHash: string;
  blockNumber: number;
  isSusdMarket: boolean;
}

export function useMarketDetail(address: string) {
  const marketAddress = address as `0x${string}`;
  const [registryMarket, setRegistryMarket] = useState<MarketDetailData | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);

  // Load from registry as fallback
  useEffect(() => {
    async function loadFromRegistry() {
      try {
        const markets = await fetchAllMarkets();
        const found = markets.find((m) => m.address.toLowerCase() === address.toLowerCase());
        if (found) {
          const isSusd = found.volume !== "0";
          setRegistryMarket({
            address: found.address,
            question: found.question,
            category: found.category,
            deadline: found.deadline,
            status: found.status,
            totalCollateral: found.volume,
            feePercent: 150,
            createdAt: "",
            yesSupply: found.yesSupply,
            noSupply: found.noSupply,
            yesOdds: found.yesPercent,
            noOdds: 100 - found.yesPercent,
            resolutionConfidence: found.resolutionConfidence,
            outcome: found.status >= 3 ? found.outcome : null,
            txHash: "",
            blockNumber: 0,
            isSusdMarket: isSusd,
          });
        }
      } catch {} finally {
        setRegistryLoading(false);
      }
    }
    if (address) loadFromRegistry();
  }, [address]);

  // Try reading from SUSD contract (only if registry says it's SUSD)
  const isSusd = registryMarket?.isSusdMarket ?? false;

  const { data: contractBatch, isLoading: batchLoading, refetch: refetchBatch } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "getMarketInfo" },
      { address: marketAddress, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "feePercent" },
      { address: marketAddress, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "yesToken" },
      { address: marketAddress, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "noToken" },
      { address: marketAddress, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "resolutionConfidence" },
    ],
    query: { enabled: !!address && isSusd },
  });

  const marketInfo = contractBatch?.[0]?.status === "success" ? contractBatch[0].result : null;
  const feePercent = contractBatch?.[1]?.status === "success" ? contractBatch[1].result : null;
  const yesTokenAddr = contractBatch?.[2]?.status === "success" ? contractBatch[2].result : null;
  const noTokenAddr = contractBatch?.[3]?.status === "success" ? contractBatch[3].result : null;
  const confidence = contractBatch?.[4]?.status === "success" ? Number(contractBatch[4].result) : null;

  const { data: supplyBatch, isLoading: supplyLoading, refetch: refetchSupply } = useReadContracts({
    contracts: [
      { address: yesTokenAddr as `0x${string}`, abi: SHARE_TOKEN_ABI, functionName: "totalSupply" },
      { address: noTokenAddr as `0x${string}`, abi: SHARE_TOKEN_ABI, functionName: "totalSupply" },
    ],
    query: { enabled: !!yesTokenAddr && !!noTokenAddr },
  });

  const yesSupply = supplyBatch?.[0]?.status === "success" ? (supplyBatch[0].result as bigint) : 0n;
  const noSupply = supplyBatch?.[1]?.status === "success" ? (supplyBatch[1].result as bigint) : 0n;

  const totalShares = yesSupply + noSupply;
  const yesOdds = totalShares > 0n ? Number((yesSupply * 100n) / totalShares) : registryMarket?.yesOdds ?? 50;
  const noOdds = 100 - yesOdds;

  // Use registry as source of truth for status/outcome (contract ABI mismatch causes bad decodes)
  const totalCollateral = totalShares > 0n ? formatUnits(yesSupply + noSupply, 18) : registryMarket?.totalCollateral ?? "0";
  const deadline = registryMarket?.deadline ?? 0;
  const status = registryMarket?.status ?? 1;
  const outcome = registryMarket?.outcome ?? null;

  // Build market data: registry for metadata, contract for supply/odds
  const market: MarketDetailData | null = address
    ? {
        address,
        question: registryMarket?.question ?? "",
        category: registryMarket?.category ?? "general",
        deadline,
        status,
        totalCollateral,
        feePercent: feePercent ? Number(feePercent) : 150,
        createdAt: "",
        yesSupply,
        noSupply,
        yesOdds,
        noOdds,
        resolutionConfidence: confidence ?? registryMarket?.resolutionConfidence ?? null,
        outcome: status >= 3 ? outcome : null,
        txHash: "",
        blockNumber: 0,
        isSusdMarket: isSusd,
      }
    : null;

  const isLoading = registryLoading || (isSusd && (batchLoading || supplyLoading));
  const error = (!registryLoading && !registryMarket) ? "Market not found in registry" : null;

  const refetch = useCallback(() => {
    refetchBatch();
    refetchSupply();
  }, [refetchBatch, refetchSupply]);

  return { market, yesOdds, noOdds, totalCollateral, isLoading, error, refetch };
}
