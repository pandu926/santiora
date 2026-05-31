"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMarkets, MarketResponse } from "@/lib/api";
import { useWebSocket, WsMessage } from "./useWebSocket";

export interface BackendMarket {
  id: string;
  address: string;
  question: string;
  category: string;
  deadline: string;
  status: "active" | "resolved";
  yesOdds: number;
  volume: string;
  aiConfidence: number;
  outcome?: boolean;
}

function toDisplayMarket(m: MarketResponse): BackendMarket {
  const yesSupply = BigInt(m.yes_supply || "0");
  const noSupply = BigInt(m.no_supply || "0");
  const total = yesSupply + noSupply;
  const yesOdds = total > 0n ? Number((yesSupply * 100n) / total) : (m.initial_odds ?? 50);

  const deadlineDate = new Date(m.deadline);
  const deadline = deadlineDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const collateralEth = (Number(m.total_collateral) / 1e18).toFixed(0);

  return {
    id: m.address,
    address: m.address,
    question: m.question,
    category: m.category,
    deadline,
    status: m.status >= 3 ? "resolved" : "active",
    yesOdds,
    volume: collateralEth,
    aiConfidence: m.resolution_confidence || yesOdds,
    outcome: m.outcome ?? undefined,
  };
}

export function useBackendMarkets() {
  const [markets, setMarkets] = useState<BackendMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage, isConnected } = useWebSocket();

  const loadMarkets = useCallback(async () => {
    try {
      const data = await fetchMarkets({ limit: 50 });
      setMarkets(data.map(toDisplayMarket));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "NewMarket" || lastMessage.type === "MarketUpdated" || lastMessage.type === "BetPlaced") {
      loadMarkets();
    }

    if (lastMessage.type === "MarketResolved") {
      loadMarkets();
    }
  }, [lastMessage, loadMarkets]);

  return { markets, isLoading, error, isConnected, refresh: loadMarkets };
}
