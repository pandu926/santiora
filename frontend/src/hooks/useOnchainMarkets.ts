"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAllMarkets, type OnchainMarket } from "@/lib/onchain";

export interface MarketDisplay {
  id: string;
  address: string;
  question: string;
  category: string;
  deadline: string;
  deadlineTs: number;
  status: "active" | "expired" | "resolved" | "failed";
  yesOdds: number;
  volume: string;
  isSusd: boolean;
  aiConfidence: number;
  outcome?: string;
}

function toDisplay(m: OnchainMarket): MarketDisplay {
  const now = Math.floor(Date.now() / 1000);
  const deadlineDate = new Date(m.deadline * 1000);
  const deadline = deadlineDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  let status: MarketDisplay["status"] = "active";
  if (m.status >= 5) status = "failed";
  else if (m.status >= 3) status = "resolved";
  else if (m.deadline < now) status = "expired";

  const isSusd = m.volume !== "0";

  return {
    id: m.address,
    address: m.address,
    question: m.question,
    category: m.category,
    deadline,
    deadlineTs: m.deadline,
    status,
    yesOdds: m.yesPercent,
    volume: isSusd ? `${m.volume} SUSD` : "—",
    isSusd,
    aiConfidence: m.resolutionConfidence || 0,
    outcome: m.status >= 3 ? (m.outcome ? "YES" : "NO") : undefined,
  };
}

const TOPIC_PATTERNS: [RegExp, string][] = [
  [/bitcoin.*\$65[,.]?000/i, "btc-65k"],
  [/bitcoin.*\$70[,.]?000/i, "btc-70k"],
  [/bitcoin.*\$60[,.]?000/i, "btc-60k"],
  [/btc.*65[,.]?000/i, "btc-65k"],
  [/btc.*70[,.]?000/i, "btc-70k"],
  [/btc.*60[,.]?000/i, "btc-60k"],
  [/bitcoin.*higher than ethereum/i, "btc-vs-eth"],
  [/ethereum.*\$3[,.]?000/i, "eth-3k"],
  [/spurs.*knicks/i, "spurs-knicks"],
  [/knicks.*spurs/i, "spurs-knicks"],
];

function topicKey(question: string): string {
  for (const [pattern, key] of TOPIC_PATTERNS) {
    if (pattern.test(question)) return key;
  }
  return question.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function deduplicateMarkets(markets: MarketDisplay[]): MarketDisplay[] {
  const seen = new Map<string, MarketDisplay>();
  for (const m of markets) {
    const key = topicKey(m.question);
    if (!seen.has(key)) {
      seen.set(key, m);
    } else {
      const existing = seen.get(key)!;
      if (m.status === "resolved" && existing.status !== "resolved") {
        seen.set(key, m);
      } else if (m.isSusd && !existing.isSusd) {
        seen.set(key, m);
      }
    }
  }
  return [...seen.values()];
}

export function useOnchainMarkets() {
  const [markets, setMarkets] = useState<MarketDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    try {
      const data = await fetchAllMarkets();
      const displayed = data.map(toDisplay);
      const deduplicated = deduplicateMarkets(displayed);
      deduplicated.sort((a, b) => {
        const statusOrder = { active: 0, expired: 1, resolved: 2, failed: 3 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        if (a.isSusd !== b.isSusd) return a.isSusd ? -1 : 1;
        return b.deadlineTs - a.deadlineTs;
      });
      setMarkets(deduplicated);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets from chain");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 30000);
    return () => clearInterval(interval);
  }, [loadMarkets]);

  return { markets, isLoading, error, refresh: loadMarkets };
}
