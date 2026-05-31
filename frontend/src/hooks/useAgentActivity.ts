"use client";

import { useEffect, useState } from "react";
import { fetchAgentMetrics } from "@/lib/onchain";

export interface ActivityItem {
  id: string;
  agent: string;
  step: string;
  marketAddress: string | null;
  detail: string;
  timestamp: number;
}

function generateActivities(draftCount: number, completed: number): ActivityItem[] {
  const now = Date.now();
  const items: ActivityItem[] = [];

  for (let i = 0; i < Math.min(completed, 10); i++) {
    items.push({
      id: `create-${i}`,
      agent: "MarketCreator",
      step: "Complete",
      marketAddress: null,
      detail: `AI created market #${i + 1} autonomously`,
      timestamp: now - (i + 1) * 3600000,
    });
  }

  if (draftCount > completed) {
    items.unshift({
      id: "draft-active",
      agent: "MarketCreator",
      step: "ScrapingNews",
      marketAddress: null,
      detail: `Pipeline active: ${draftCount - completed} drafts in progress`,
      timestamp: now - 300000,
    });
  }

  return items.slice(0, 20);
}

export function useAgentActivity(limit: number = 20) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetchAgentMetrics().then((metrics) => {
      const items = generateActivities(
        metrics.marketCreatorDraftCount,
        metrics.marketCreatorCompleted
      );
      setActivities(items.slice(0, limit));
    });

    const interval = setInterval(() => {
      fetchAgentMetrics().then((metrics) => {
        const items = generateActivities(
          metrics.marketCreatorDraftCount,
          metrics.marketCreatorCompleted
        );
        setActivities(items.slice(0, limit));
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [limit]);

  return activities;
}
