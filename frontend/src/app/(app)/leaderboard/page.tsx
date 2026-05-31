"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { fetchLeaderboard, LeaderboardTrader } from "@/lib/api";

export default function LeaderboardPage() {
  const [traders, setTraders] = useState<LeaderboardTrader[]>([]);

  useEffect(() => {
    fetchLeaderboard().then(data => setTraders(data.traders)).catch(() => {});
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Leaderboard" description="Top traders by profit — live from chain" />
      <Card>
        <div className="grid grid-cols-[40px_1fr_60px_60px_80px] items-center px-4 py-2 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>#</span><span>Trader</span><span className="text-right">Bets</span><span className="text-right">Win%</span><span className="text-right">Volume</span>
        </div>
        {traders.length > 0 ? traders.map(t => (
          <div key={t.rank} className="grid grid-cols-[40px_1fr_60px_60px_80px] items-center px-4 py-3 border-b last:border-0 hover:bg-muted/50">
            <span className="font-mono font-bold">{t.rank <= 3 ? <Trophy className="w-4 h-4 text-accent inline" /> : t.rank}</span>
            <span className="font-mono text-sm">{t.address}</span>
            <span className="text-right font-mono text-xs">{t.totalBets}</span>
            <span className="text-right font-mono text-xs">{t.winRate}%</span>
            <span className="text-right font-mono text-xs">{t.volume.toFixed(0)}</span>
          </div>
        )) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No traders yet. Be the first to place a bet!</div>
        )}
      </Card>
    </PageTransition>
  );
}
