"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useSpeedStats } from "@/contexts/SpeedContext";

interface TxConfirmationProps {
  confirmationMs: number | null;
  gasCostWei: string | null;
  isVisible: boolean;
}

export function TxConfirmationOverlay({ confirmationMs, gasCostWei, isVisible }: TxConfirmationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible && confirmationMs !== null) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, confirmationMs]);

  if (!show || confirmationMs === null) return null;

  const seconds = (confirmationMs / 1000).toFixed(1);
  const gasCostEth = gasCostWei ? formatEther(BigInt(gasCostWei)) : "0";
  const gasCostUsd = (parseFloat(gasCostEth) * 0.5).toFixed(4);

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300">
      <div className="rounded-lg border border-green-200 bg-white shadow-lg p-3 space-y-1 min-w-[220px]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-green-700">
            Confirmed in {seconds}s
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          Cost: ${gasCostUsd} <span className="text-zinc-400">(vs $2.50 on Ethereum)</span>
        </div>
      </div>
    </div>
  );
}

export function SpeedTicker() {
  const { averageMs, lastMs, records } = useSpeedStats();

  const displayMs = lastMs ?? averageMs;
  const seconds = (displayMs / 1000).toFixed(1);
  const txCount = records.length;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
      <span className="font-mono text-green-700 font-medium">{seconds}s</span>
      <span className="text-zinc-400">avg</span>
      {txCount > 0 && (
        <span className="text-zinc-300">({txCount} txs)</span>
      )}
    </div>
  );
}
