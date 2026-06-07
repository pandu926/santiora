"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchV5Markets, type V5Market } from "@/lib/onchain";

const POLL_INTERVAL = 15000;

export interface OnchainActivity {
  id: string;
  type: "create" | "resolve" | "schedule" | "agent" | "market" | "skip" | "system";
  title: string;
  detail: string;
  timestamp: number;
  txHash?: string;
  blockNumber: number;
}

function marketToActivities(m: V5Market): OnchainActivity[] {
  const items: OnchainActivity[] = [];
  const ts = m.createdAt;

  // Creation event
  if (m.question && ts > 0) {
    items.push({
      id: `create-${m.id}`,
      type: "agent",
      title: "Market Creating",
      detail: `AI pipeline started for market #${m.id}`,
      timestamp: ts,
      blockNumber: m.id * 100, // synthetic — no block data available
    });
  }

  // Market active
  if (m.status >= 1 && m.question && ts > 0) {
    items.push({
      id: `active-${m.id}`,
      type: "market",
      title: "Market Active",
      detail: m.question.length > 80 ? m.question.slice(0, 80) + "…" : m.question,
      timestamp: ts + 5,
      blockNumber: m.id * 100 + 1,
    });
  }

  // Resolving
  if (m.status >= 2 && ts > 0) {
    items.push({
      id: `resolving-${m.id}`,
      type: "resolve",
      title: "Market Resolving",
      detail: `Resolution pipeline started for market #${m.id}`,
      timestamp: m.deadline + 1,
      blockNumber: m.id * 100 + 2,
    });
  }

  // Resolved
  if (m.status >= 3 && m.outcome && ts > 0) {
    items.push({
      id: `resolved-${m.id}`,
      type: "resolve",
      title: "Market Resolved",
      detail: `Outcome: ${m.outcome} (${m.confidence}% confidence)`,
      timestamp: m.deadline + 10,
      blockNumber: m.id * 100 + 3,
    });
  }

  return items;
}

export function useOnchainActivity(limit: number = 50) {
  const [activities, setActivities] = useState<OnchainActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const markets = await fetchV5Markets();
      const all: OnchainActivity[] = markets.flatMap(marketToActivities);
      all.sort((a, b) => b.timestamp - a.timestamp);
      setActivities(all.slice(0, limit));
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  return { activities, loading };
}
