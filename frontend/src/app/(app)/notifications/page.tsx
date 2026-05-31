"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { isConnected } = useAccount();

  return (
    <PageTransition>
      <PageHeader title="Notifications" />
      {!isConnected ? (
        <div className="text-center py-16"><Bell className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Connect wallet to see notifications</p></div>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">No notifications yet. You'll be notified when your bets resolve or markets you follow have updates.</Card>
      )}
    </PageTransition>
  );
}
