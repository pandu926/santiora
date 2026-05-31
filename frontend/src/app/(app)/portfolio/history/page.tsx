"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { History } from "lucide-react";
import { fetchMarkets } from "@/lib/api";

export default function PortfolioHistoryPage() {
  const { isConnected, address } = useAccount();

  if (!isConnected) {
    return (
      <PageTransition>
        <PageHeader title="Bet History" />
        <div className="text-center py-16"><History className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Connect wallet to view bet history</p></div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader title="Bet History" description={`${address?.slice(0,6)}...${address?.slice(-4)}`} />
      <Card className="p-6 text-center text-sm text-muted-foreground">No bets placed yet. Go to Markets to place your first bet.</Card>
    </PageTransition>
  );
}
