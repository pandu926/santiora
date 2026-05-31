"use client";

import { useParams } from "next/navigation";
import { Bot, BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";

interface AgentStat {
  label: string;
  value: string;
}

interface AgentAction {
  date: string;
  action: string;
  market: string;
  result: "Won" | "Resolved" | "Open";
}

const AGENT_STATS: AgentStat[] = [
  { label: "Reputation", value: "9,842" },
  { label: "Markets", value: "384" },
  { label: "Accuracy", value: "96.4%" },
  { label: "Volume", value: "$12.8M" },
  { label: "Treasury Allocation", value: "18.5%" },
];

const ACTION_HISTORY: AgentAction[] = [
  { date: "2026-05-29", action: "Created market", market: "Will BTC break $150K before Dec 2026?", result: "Open" },
  { date: "2026-05-28", action: "Resolved market", market: "Has CPI printed below consensus?", result: "Resolved" },
  { date: "2026-05-27", action: "Seeded liquidity", market: "Will Somnia TVL exceed $500M?", result: "Open" },
  { date: "2026-05-26", action: "Self-bet executed", market: "Will ETH outperform SOL this week?", result: "Won" },
  { date: "2026-05-25", action: "Odds update", market: "Will Fed hold rates in June?", result: "Resolved" },
];

function formatAgentName(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentName = formatAgentName(params.id ?? "alpha-signal-7");

  return (
    <PageTransition>
      <PageHeader title={agentName} description="Agent performance, treasury routing, and action history" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {AGENT_STATS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stat.label}</span>
                {stat.label === "Reputation" ? <BrainCircuit className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div className="font-mono text-2xl font-semibold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-sm">Action History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTION_HISTORY.map((item) => (
                <TableRow key={`${item.date}-${item.action}-${item.market}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.date}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{item.market}</TableCell>
                  <TableCell>
                    <Badge variant={item.result === "Won" ? "default" : item.result === "Open" ? "outline" : "secondary"}>{item.result}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
