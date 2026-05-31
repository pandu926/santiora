"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { Gift } from "lucide-react";

export default function PortfolioClaimsPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <PageTransition>
        <PageHeader title="Claimable Winnings" />
        <div className="text-center py-16"><Gift className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Connect wallet to view claimable winnings</p></div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader title="Claimable Winnings" />
      <Card className="p-6 text-center text-sm text-muted-foreground">No winnings to claim. Winnings become claimable after markets you bet on are resolved.</Card>
    </PageTransition>
  );
}
