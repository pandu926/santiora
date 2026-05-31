"use client";

import { Activity, Briefcase, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolio, type PortfolioPosition } from "@/hooks/usePortfolio";

function formatSusd(value: string): string {
  const num = Number(value);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SummarySkeleton() {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-[320px]" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PositionRow({
  position,
  onClaim,
  claimState,
}: {
  position: PortfolioPosition;
  onClaim: (address: string) => void;
  claimState: string;
}) {
  const pnlValue = Number(position.pnl);
  const pnlPrefix = pnlValue >= 0 ? "+" : "";
  const isResolved = position.status >= 3;

  return (
    <TableRow>
      <TableCell className="max-w-[480px] whitespace-normal font-medium">
        <div className="flex flex-col gap-0.5">
          <span>{position.question}</span>
          {isResolved && (
            <span className="text-xs text-muted-foreground">
              Resolved: {position.outcome ? "YES" : "NO"}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={position.side === "YES" ? "default" : "secondary"}>
          {position.side}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">{formatSusd(position.shares)}</TableCell>
      <TableCell className="text-right font-mono">{formatSusd(position.currentValue)}</TableCell>
      <TableCell
        className={
          position.isProfit
            ? "text-right font-mono text-emerald-600"
            : "text-right font-mono text-red-600"
        }
      >
        {pnlPrefix}{formatSusd(position.pnl)}
      </TableCell>
      <TableCell className="text-right">
        {position.canClaim && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onClaim(position.marketAddress)}
            disabled={claimState === "pending" || claimState === "confirming"}
          >
            {claimState === "pending"
              ? "Signing..."
              : claimState === "confirming"
                ? "Confirming..."
                : "Claim"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full border bg-muted/40 p-4">
          <Briefcase className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No positions yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Place a bet on any market to start building your portfolio.
          </p>
        </div>
        <Link href="/markets">
          <Button>Browse Markets</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const { isConnected } = useAccount();
  const { positions, summary, isLoading, claimWinnings, claimState } = usePortfolio();

  if (!isConnected) {
    return (
      <PageTransition>
        <PageHeader title="Portfolio" description="Track active prediction market exposure and returns" />
        <Card className="border-dashed">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full border bg-muted/40 p-4">
              <Wallet className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Connect Wallet</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Connect your wallet to view open positions, realized P&L, and market exposure.
              </p>
            </div>
            <Button>Connect Wallet</Button>
          </CardContent>
        </Card>
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <PageTransition>
        <PageHeader title="Portfolio" description="Live exposure, unrealized returns, and settlement outlook" />
        <SummarySkeleton />
        <TableSkeleton />
      </PageTransition>
    );
  }

  if (positions.length === 0) {
    return (
      <PageTransition>
        <PageHeader title="Portfolio" description="Live exposure, unrealized returns, and settlement outlook" />
        <EmptyState />
      </PageTransition>
    );
  }

  const pnlValue = Number(summary.totalPnl);
  const pnlPrefix = pnlValue >= 0 ? "+" : "";

  const summaryCards = [
    {
      label: "Total Invested",
      value: `${formatSusd(summary.totalInvested)} SUSD`,
      delta: `${summary.positionCount} positions`,
      icon: Briefcase,
      isPositive: true,
    },
    {
      label: "Current Value",
      value: `${formatSusd(summary.totalCurrentValue)} SUSD`,
      delta: `${pnlPrefix}${formatSusd(summary.totalPnl)} SUSD`,
      icon: Wallet,
      isPositive: summary.isProfit,
    },
    {
      label: "P&L",
      value: `${pnlPrefix}${formatSusd(summary.totalPnl)} SUSD`,
      delta: `${pnlPrefix}${summary.totalPnlPercent.toFixed(1)}%`,
      icon: summary.isProfit ? TrendingUp : TrendingDown,
      isPositive: summary.isProfit,
    },
    {
      label: "Win Rate",
      value: `${summary.winRate}%`,
      delta: `${positions.filter((p) => p.status >= 3).length} settled`,
      icon: Target,
      isPositive: Number(summary.winRate) >= 50,
    },
  ];

  return (
    <PageTransition>
      <PageHeader title="Portfolio" description="Live exposure, unrealized returns, and settlement outlook" />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} size="sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-semibold tracking-tight">{metric.value}</div>
                <div
                  className={
                    metric.isPositive
                      ? "mt-1 flex items-center gap-1 font-mono text-xs text-emerald-600"
                      : "mt-1 flex items-center gap-1 font-mono text-xs text-red-600"
                  }
                >
                  {metric.isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {metric.delta}
                </div>
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
              Active Positions
            </CardTitle>
            <Badge variant="outline" className="font-mono">
              {positions.length} {positions.length === 1 ? "POSITION" : "POSITIONS"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market Question</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <PositionRow
                  key={`${position.marketAddress}-${position.side}`}
                  position={position}
                  onClaim={claimWinnings}
                  claimState={claimState}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
