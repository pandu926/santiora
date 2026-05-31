"use client";

import { Activity, BarChart3, CalendarDays, Star, Target, Trophy } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileStat {
  label: string;
  value: string;
  icon: typeof BarChart3;
}

interface ActivityItem {
  action: string;
  market: string;
  time: string;
  amount: string;
}

const profileStats: ProfileStat[] = [
  { label: "Total Bets", value: "128", icon: BarChart3 },
  { label: "Win Rate", value: "64.8%", icon: Trophy },
  { label: "Favorite Category", value: "Crypto", icon: Star },
  { label: "Member Since", value: "Jan 2026", icon: CalendarDays },
];

const recentActivity: ActivityItem[] = [
  { action: "Bought YES", market: "BTC > $150K by end of 2026", time: "12m ago", amount: "$450.00" },
  { action: "Claimed winnings", market: "BTC weekly close above $110K", time: "2h ago", amount: "$1,662.50" },
  { action: "Bought NO", market: "ETH reaches $10K by end of 2026", time: "1d ago", amount: "$780.00" },
  { action: "Position settled", market: "ETH ETF inflows exceed $1B", time: "3d ago", amount: "+$287.10" },
];

export default function ProfilePage() {
  return (
    <PageTransition>
      <PageHeader title="Profile" description="Trading identity, performance profile, and recent protocol activity" />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {profileStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} size="sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Recent Activity
            </CardTitle>
            <Badge variant="outline" className="font-mono">LIVE</Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {recentActivity.map((item) => (
            <div key={`${item.action}-${item.market}`} className="grid gap-3 p-4 md:grid-cols-[160px_1fr_120px_100px] md:items-center">
              <div className="flex items-center gap-2 font-medium">
                <Target className="size-4 text-muted-foreground" />
                {item.action}
              </div>
              <div className="text-sm text-muted-foreground">{item.market}</div>
              <div className="font-mono text-xs text-muted-foreground md:text-right">{item.time}</div>
              <div className={item.amount.startsWith("+") ? "font-mono text-sm text-emerald-600 md:text-right" : "font-mono text-sm md:text-right"}>{item.amount}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
