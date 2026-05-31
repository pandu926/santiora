"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

export default function ReferralPage() {
  return (
    <PageTransition>
      <PageHeader title="Referral Program" description="Invite friends, earn rewards" />
      <Card className="p-6 max-w-md mx-auto space-y-4">
        <p className="text-xs text-muted-foreground">Share your referral link and earn 5% of your referrals trading fees.</p>
        <div className="flex items-center gap-2 bg-muted rounded-md p-3">
          <span className="font-mono text-xs flex-1 truncate">https://santiora.rbexp.com/ref/0x1a2b</span>
          <Button variant="ghost" size="sm"><Copy className="w-3.5 h-3.5" /></Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><p className="text-xs text-muted-foreground">Referrals</p><p className="font-mono font-bold mt-1">0</p></div>
          <div><p className="text-xs text-muted-foreground">Earnings</p><p className="font-mono font-bold mt-1">0 STT</p></div>
        </div>
      </Card>
    </PageTransition>
  );
}
