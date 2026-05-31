"use client";

import { Award, Bolt, Medal, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface XpEvent {
  source: string;
  xp: string;
  time: string;
}

const currentXp = 7420;
const nextLevelXp = 10000;
const progressPercent = Math.round((currentXp / nextLevelXp) * 100);

const recentXpEvents: XpEvent[] = [
  { source: "Resolved winning position", xp: "+450 XP", time: "2h ago" },
  { source: "Provided market liquidity", xp: "+320 XP", time: "8h ago" },
  { source: "Traded AI-created market", xp: "+180 XP", time: "1d ago" },
  { source: "Maintained 5-day activity streak", xp: "+250 XP", time: "2d ago" },
];

export default function RewardsPage() {
  return (
    <PageTransition>
      <PageHeader title="Rewards" description="XP progression for trading, liquidity, and autonomous market participation" />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Award className="size-4" />
                XP Progress
              </CardTitle>
              <Badge variant="default" className="font-mono">{progressPercent}%</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current XP</div>
                <div className="font-mono text-3xl font-semibold">{currentXp.toLocaleString()}</div>
              </div>
              <div className="text-right font-mono text-sm text-muted-foreground">{nextLevelXp.toLocaleString()} XP next level</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Medal className="size-4" />
              Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-4xl font-semibold">12</div>
            <div className="mt-1 text-sm text-muted-foreground">Autonomous Market Specialist</div>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs text-emerald-600">
              <TrendingUp className="size-3" />
              +1,200 XP this week
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Bolt className="size-4" />
              Recent XP Earned
            </CardTitle>
            <Badge variant="outline" className="font-mono">4 EVENTS</Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {recentXpEvents.map((event) => (
            <div key={`${event.source}-${event.time}`} className="grid gap-2 p-4 md:grid-cols-[1fr_120px_100px] md:items-center">
              <div className="font-medium">{event.source}</div>
              <div className="font-mono text-sm text-emerald-600 md:text-right">{event.xp}</div>
              <div className="font-mono text-xs text-muted-foreground md:text-right">{event.time}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
