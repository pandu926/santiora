"use client";

import { useEffect, useState, useCallback } from "react";
import { useReadContracts, useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { PREDICTION_MARKET_SUSD_ABI } from "@/lib/abi/PredictionMarketSUSD";
import { SHARE_TOKEN_ABI } from "@/lib/abi/ShareToken";
import { SANTIORA_V5, fetchAllMarkets } from "@/lib/onchain";

const V5_ABI = [
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

function parseMarketParam(address: string): { isV5: boolean; marketId: number } {
  const decoded = decodeURIComponent(address);
  const colonIdx = decoded.lastIndexOf(":");
  if (colonIdx > 0 && colonIdx < decoded.length - 1) {
    const id = parseInt(decoded.slice(colonIdx + 1), 10);
    if (!isNaN(id)) return { isV5: true, marketId: id };
  }
  return { isV5: false, marketId: -1 };
}

export function useMarketDetail(address: string) {
  const { isV5, marketId } = parseMarketParam(address);

  // ── V5 path: read directly by market ID ──────────────────────────
  const { data: v5Data, isLoading: v5Loading, refetch: refetchV5 } = useReadContract({
    address: SANTIORA_V5 as Address,
    abi: V5_ABI,
    functionName: "markets",
    args: [BigInt(marketId >= 0 ? marketId : 0)],
    query: { enabled: isV5 && marketId >= 0 },
  });

  // ── Legacy SUSD path: load from registry ─────────────────────────
  const [registryMarket, setRegistryMarket] = useState<MarketDetailData | null>(null);
  const [registryLoading, setRegistryLoading] = useState(!isV5);

  useEffect(() => {
    if (isV5) return;
    setRegistryLoading(true);
    async function load() {
      try {
        const markets = await fetchAllMarkets();
        const decoded = decodeURIComponent(address);
        const found = markets.find(
          (m) =>
            m.address.toLowerCase() === decoded.toLowerCase() ||
            m.address.toLowerCase() === address.toLowerCase()
        );
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
      } catch {
        // ignore
      } finally {
        setRegistryLoading(false);
      }
    }
    load();
  }, [address, isV5]);

  const isSusd = registryMarket?.isSusdMarket ?? false;

  const { data: contractBatch, isLoading: batchLoading, refetch: refetchBatch } = useReadContracts({
    contracts: [
      { address: address as `0x${string}`, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "getMarketInfo" },
      { address: address as `0x${string}`, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "feePercent" },
      { address: address as `0x${string}`, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "yesToken" },
      { address: address as `0x${string}`, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "noToken" },
      { address: address as `0x${string}`, abi: PREDICTION_MARKET_SUSD_ABI, functionName: "resolutionConfidence" },
    ],
    query: { enabled: !isV5 && !!address && isSusd },
  });

  const feePercent = contractBatch?.[1]?.status === "success" ? contractBatch[1].result : null;
  const yesTokenAddr = contractBatch?.[2]?.status === "success" ? (contractBatch[2].result as string) : null;
  const noTokenAddr = contractBatch?.[3]?.status === "success" ? (contractBatch[3].result as string) : null;
  const confidence = contractBatch?.[4]?.status === "success" ? Number(contractBatch[4].result) : null;

  const { data: supplyBatch, isLoading: supplyLoading, refetch: refetchSupply } = useReadContracts({
    contracts: [
      { address: yesTokenAddr as `0x${string}`, abi: SHARE_TOKEN_ABI, functionName: "totalSupply" },
      { address: noTokenAddr as `0x${string}`, abi: SHARE_TOKEN_ABI, functionName: "totalSupply" },
    ],
    query: { enabled: !isV5 && !!yesTokenAddr && !!noTokenAddr },
  });

  const refetch = useCallback(() => {
    if (isV5) refetchV5();
    else { refetchBatch(); refetchSupply(); }
  }, [isV5, refetchV5, refetchBatch, refetchSupply]);

  // ── Build result ──────────────────────────────────────────────────
  if (isV5) {
    if (v5Loading) return { market: null, yesOdds: 50, noOdds: 50, totalCollateral: "0", isLoading: true, error: null, refetch };

    if (!v5Data) return { market: null, yesOdds: 50, noOdds: 50, totalCollateral: "0", isLoading: false, error: "Market not found", refetch };

    const [question, odds, deadline, category, status, outcome, conf, createdAt] =
      v5Data as [string, bigint, bigint, string, number, string, bigint, bigint, string, string];

    const statusNum = Number(status);
    const oddsNum = Number(odds);
    const yesOdds = oddsNum > 0 ? oddsNum : 50;
    const noOdds = 100 - yesOdds;

    const market: MarketDetailData = {
      address,
      question,
      category,
      deadline: Number(deadline),
      status: statusNum >= 3 ? 3 : statusNum >= 1 ? 1 : 0,
      totalCollateral: "0",
      feePercent: 150,
      createdAt: Number(createdAt) > 0 ? new Date(Number(createdAt) * 1000).toISOString() : "",
      yesSupply: 0n,
      noSupply: 0n,
      yesOdds,
      noOdds,
      resolutionConfidence: Number(conf) > 0 ? Number(conf) : null,
      outcome: statusNum >= 3 ? outcome === "YES" : null,
      txHash: "",
      blockNumber: 0,
      isSusdMarket: false,
    };

    return { market, yesOdds, noOdds, totalCollateral: "0", isLoading: false, error: null, refetch };
  }

  // Legacy SUSD
  const yesSupply = supplyBatch?.[0]?.status === "success" ? (supplyBatch[0].result as bigint) : 0n;
  const noSupply = supplyBatch?.[1]?.status === "success" ? (supplyBatch[1].result as bigint) : 0n;
  const totalShares = yesSupply + noSupply;
  const yesOdds = totalShares > 0n ? Number((yesSupply * 100n) / totalShares) : (registryMarket?.yesOdds ?? 50);
  const noOdds = 100 - yesOdds;
  const totalCollateral = totalShares > 0n ? formatUnits(totalShares, 18) : (registryMarket?.totalCollateral ?? "0");

  const market: MarketDetailData | null = address
    ? {
        address,
        question: registryMarket?.question ?? "",
        category: registryMarket?.category ?? "general",
        deadline: registryMarket?.deadline ?? 0,
        status: registryMarket?.status ?? 1,
        totalCollateral,
        feePercent: feePercent ? Number(feePercent) : 150,
        createdAt: "",
        yesSupply,
        noSupply,
        yesOdds,
        noOdds,
        resolutionConfidence: confidence ?? registryMarket?.resolutionConfidence ?? null,
        outcome: (registryMarket?.status ?? 1) >= 3 ? (registryMarket?.outcome ?? null) : null,
        txHash: "",
        blockNumber: 0,
        isSusdMarket: isSusd,
      }
    : null;

  const isLoading = registryLoading || (isSusd && (batchLoading || supplyLoading));
  const error = !registryLoading && !registryMarket ? "Market not found" : null;

  return { market, yesOdds, noOdds, totalCollateral, isLoading, error, refetch };
}
