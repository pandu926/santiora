"use client";

import { useResolution } from "@/hooks/useResolution";

const STEP_LABELS: Record<string, string> = {
  none: "Not Started",
  pending: "Queued",
  resolving: "Resolving",
  resolved: "Resolved",
  delayed: "Delayed (Retry Scheduled)",
  failed: "Failed",
};

const STEP_COLORS: Record<string, string> = {
  none: "text-zinc-400",
  pending: "text-yellow-500",
  resolving: "text-blue-500",
  resolved: "text-green-500",
  delayed: "text-orange-500",
  failed: "text-red-500",
};

export function ResolutionPanel({ marketAddress }: { marketAddress: string }) {
  const { data, isLoading, error } = useResolution(marketAddress);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 animate-pulse">
        <div className="h-4 bg-zinc-100 rounded w-1/3 mb-2" />
        <div className="h-3 bg-zinc-100 rounded w-2/3" />
      </div>
    );
  }

  if (error || !data) return null;
  if (data.status === "none") return null;

  const statusColor = STEP_COLORS[data.status] || "text-zinc-500";
  const statusLabel = STEP_LABELS[data.status] || data.status;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Resolution Status</h3>
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {data.status === "resolving" && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-zinc-600">AI agents verifying outcome...</span>
        </div>
      )}

      {data.status === "resolved" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-zinc-900">
              {data.outcome ? "YES" : "NO"}
            </span>
            <span className="text-sm text-zinc-500">
              {data.confidence}% confidence
            </span>
          </div>
          {data.reasoning && (
            <p className="text-xs text-zinc-600 leading-relaxed">{data.reasoning}</p>
          )}
          {data.resolved_at && (
            <p className="text-xs text-zinc-400">
              Resolved: {new Date(data.resolved_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {data.status === "delayed" && (
        <div className="space-y-1">
          <p className="text-xs text-zinc-600">
            Confidence too low ({data.confidence}%). Retrying after{" "}
            {data.retry_after ? new Date(data.retry_after).toLocaleString() : "6h"}.
          </p>
          <p className="text-xs text-zinc-400">Retry #{data.retry_count}</p>
        </div>
      )}

      {data.status === "failed" && (
        <p className="text-xs text-red-600">
          Resolution failed. Will retry on next cycle.
        </p>
      )}

      {data.tx_hash && (
        <a
          href={`https://somnia-testnet.socialscan.io/tx/${data.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          View on Explorer
        </a>
      )}
    </div>
  );
}
