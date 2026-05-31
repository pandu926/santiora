"use client";

import { useState, useEffect } from "react";

export interface ResolutionData {
  market_address: string;
  status: "none" | "pending" | "resolving" | "resolved" | "delayed" | "failed";
  outcome: boolean | null;
  confidence: number | null;
  reasoning: string | null;
  evidence: string | null;
  retry_count: number;
  retry_after: string | null;
  started_at: string | null;
  resolved_at: string | null;
  tx_hash: string | null;
}

export function useResolution(marketAddress: string) {
  const [data, setData] = useState<ResolutionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketAddress) return;

    const fetchResolution = async () => {
      setIsLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://santiora.rbexp.com/api";
        const res = await fetch(`${apiBase}/markets/${marketAddress}/resolution`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to fetch resolution";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResolution();
  }, [marketAddress]);

  return { data, isLoading, error };
}
