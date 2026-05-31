"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { fetchSelfBetting } from "@/lib/api";
import { AnimatedList, AnimatedItem } from "@/components/shared/Animations";

export default function AISelfBettingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSelfBetting().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <PageHeader title="AI Self-Betting" description="AI bets on its own predictions — skin in the game (live)" />
      <AnimatedList className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <AnimatedItem><Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Bets</p><p className="text-2xl font-mono font-bold mt-1">{data?.totalBets ?? 0}</p></Card></AnimatedItem>
        <AnimatedItem><Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Win Rate</p><p className="text-2xl font-mono font-bold text-success mt-1">{data?.winRate ?? 0}%</p></Card></AnimatedItem>
        <AnimatedItem><Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Net P&L</p><p className="text-2xl font-mono font-bold mt-1">{data?.netPnL >= 0 ? "+" : ""}{data?.netPnL?.toFixed(2) ?? "0.00"}</p></Card></AnimatedItem>
        <AnimatedItem><Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Wins</p><p className="text-2xl font-mono font-bold mt-1">{data?.wins ?? 0}</p></Card></AnimatedItem>
      </AnimatedList>
      {!loading && data?.totalBets === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">AI hasn't placed any self-bets yet. This will happen once markets are created and the AI has confidence in outcomes.</Card>
      )}
    </PageTransition>
  );
}
