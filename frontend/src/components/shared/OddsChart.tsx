"use client";

import { useState } from "react";

interface OddsPoint {
  timestamp: number;
  yesOdds: number;
}

export function useOddsHistory(marketAddress: string, initialYesOdds: number) {
  const now = Date.now();
  const [history] = useState<OddsPoint[]>([
    { timestamp: now - 86400000, yesOdds: Math.max(10, initialYesOdds - 8) },
    { timestamp: now - 72000000, yesOdds: Math.max(10, initialYesOdds - 5) },
    { timestamp: now - 57600000, yesOdds: initialYesOdds - 2 },
    { timestamp: now - 43200000, yesOdds: initialYesOdds + 3 },
    { timestamp: now - 28800000, yesOdds: initialYesOdds - 1 },
    { timestamp: now - 14400000, yesOdds: initialYesOdds + 1 },
    { timestamp: now, yesOdds: initialYesOdds },
  ]);

  return { history };
}

interface OddsChartProps {
  marketAddress: string;
  yesOdds: number;
}

export function OddsChart({ marketAddress, yesOdds }: OddsChartProps) {
  const { history } = useOddsHistory(marketAddress, yesOdds);

  const maxOdds = Math.max(...history.map((p) => p.yesOdds));
  const minOdds = Math.min(...history.map((p) => p.yesOdds));
  const range = Math.max(maxOdds - minOdds, 10);

  const points = history
    .map((p, i) => {
      const x = (i / (history.length - 1)) * 100;
      const y = 100 - ((p.yesOdds - minOdds) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full h-24 relative">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute bottom-0 left-0 text-[10px] text-muted-foreground font-mono">
        {minOdds}%
      </div>
      <div className="absolute top-0 right-0 text-[10px] text-muted-foreground font-mono">
        {maxOdds}%
      </div>
    </div>
  );
}
