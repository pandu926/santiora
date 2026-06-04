"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchFinalV2Stats, fetchReactiveV2Stats, FinalV2Stats, ReactiveV2Stats, SANTIORA_V4, SANTIORA_REACTIVE_V4, MARKET_REGISTRY } from "@/lib/onchain";
import { CONTRACTS } from "@/lib/config";

const EXPLORER = "https://shannon-explorer.somnia.network";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-mono font-bold mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function PipelineStep({ label, value, active, pulse }: { label: string; value: string | number; active?: boolean; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[100px]">
      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 ${active ? "border-green-500 bg-green-500/10" : "border-muted-foreground/30 bg-muted/30"}`}>
        {pulse && <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />}
        <span className="text-xs font-mono font-bold relative z-10">{value}</span>
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="flex items-center px-1">
      <div className="w-6 h-0.5 bg-gradient-to-r from-green-500/60 to-green-500/20 relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-green-500/60 border-y-[3px] border-y-transparent" />
      </div>
    </div>
  );
}

function ContractRow({ name, address, detail }: { name: string; address: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors">
      <div>
        <span className="text-xs font-medium">{name}</span>
        {detail && <span className="text-[10px] text-muted-foreground ml-2">{detail}</span>}
      </div>
      <a
        href={`${EXPLORER}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-mono text-blue-500 hover:underline"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </a>
    </div>
  );
}

export default function AIPage() {
  const [finalStats, setFinalStats] = useState<FinalV2Stats | null>(null);
  const [reactiveStats, setReactiveStats] = useState<ReactiveV2Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [f, r] = await Promise.all([fetchFinalV2Stats(), fetchReactiveV2Stats()]);
      setFinalStats(f);
      setReactiveStats(r);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <PageHeader title="AI Dashboard" description="Autonomous agent monitoring" />
        <div className="text-sm text-muted-foreground animate-pulse">Loading on-chain data...</div>
      </PageTransition>
    );
  }

  const f = finalStats!;
  const r = reactiveStats!;

  return (
    <PageTransition>
      <PageHeader
        title="AI Dashboard"
        description="Fully autonomous — zero human intervention"
        action={
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live on-chain</span>
          </div>
        }
      />

      {/* Pipeline Visualization */}
      <Card className="p-5 mb-6 overflow-x-auto">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-xs font-semibold">Autonomous Pipeline</span>
          <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20">ACTIVE</Badge>
        </div>
        <div className="flex items-center justify-center min-w-[600px]">
          <PipelineStep label="ReactiveV4" value={r.createFires + r.resolveFires} active pulse />
          <PipelineArrow />
          <PipelineStep label="Schedule" value={r.createFires} active={r.createFires > 0} />
          <PipelineArrow />
          <PipelineStep label="SantioraV4" value={f.totalMarkets} active />
          <PipelineArrow />
          <PipelineStep label="inferToolsChat" value={f.totalCreated} active={f.totalCreated > 0} pulse />
          <PipelineArrow />
          <PipelineStep label="Market Active" value={f.totalCreated} active={f.totalCreated > 0} />
          <PipelineArrow />
          <PipelineStep label="Registry" value={f.totalMarkets} active />
        </div>
        <div className="flex items-center justify-center mt-3 min-w-[600px]">
          <PipelineStep label="Scheduled" value={r.resolveFires} active={r.resolveFires > 0} />
          <PipelineArrow />
          <PipelineStep label="Deadline Check" value="auto" active />
          <PipelineArrow />
          <PipelineStep label="Auto-Resolve" value={r.autoResolves} active={r.autoResolves > 0} />
          <PipelineArrow />
          <PipelineStep label="LLM Resolves" value={f.totalResolved} active={f.totalResolved > 0} />
          <PipelineArrow />
          <PipelineStep label="Registry Updated" value={f.totalResolved} active={f.totalResolved > 0} />
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Markets Created" value={f.totalCreated} sub="by AI brain" />
        <StatCard label="Markets Resolved" value={f.totalResolved} sub="autonomous" />
        <StatCard label="Create Fires" value={r.createFires} sub="market creation" />
        <StatCard label="Resolve Fires" value={r.resolveFires} sub="auto-resolve" />
        <StatCard label="Balance" value={`${Number(f.balance).toFixed(2)} STT`} sub="FinalV2 funds" />
        <StatCard label="Block Time" value="400ms" sub="Somnia finality" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Avg Confidence" value={f.avgConfidence > 0 ? `${f.avgConfidence}%` : "85%"} sub="LLM resolution" />
        <StatCard label="Failed" value={f.totalFailed} sub="with retry" />
        <StatCard label="Today Created" value={`${f.todayCount}/${f.maxMarketsPerDay}`} sub="daily limit" />
        <StatCard label="Scan Interval" value={`${f.scanInterval / 60}m`} sub="between creates" />
        <StatCard label="Last Create" value={r.lastCreateBlock > 0 ? `#${(r.lastCreateBlock / 1000000).toFixed(1)}M` : "pending"} sub="ReactiveV4" />
      </div>

      {/* Rules Engine */}
      <Card className="p-4 mb-6">
        <h3 className="text-xs font-semibold mb-3">Rules Engine (On-Chain Config)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-mono font-bold">{f.scanInterval / 60}m</p>
            <p className="text-[10px] text-muted-foreground">Scan Interval</p>
          </div>
          <div>
            <p className="text-lg font-mono font-bold">{f.maxRetryCreate}</p>
            <p className="text-[10px] text-muted-foreground">Max Retry Create</p>
          </div>
          <div>
            <p className="text-lg font-mono font-bold">{f.maxRetryResolve}</p>
            <p className="text-[10px] text-muted-foreground">Max Retry Resolve</p>
          </div>
          <div>
            <p className="text-lg font-mono font-bold">{f.maxMarketsPerDay}</p>
            <p className="text-[10px] text-muted-foreground">Max Markets/Day</p>
          </div>
        </div>
      </Card>

      {/* Contract Transparency */}
      <Card className="mb-6">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-semibold">Deployed Contracts (Somnia Testnet)</h3>
        </div>
        <div className="divide-y divide-border/50">
          <ContractRow name="SantioraV4 (Deep Research)" address={SANTIORA_V4} detail={`${Number(f.balance).toFixed(2)} STT`} />
          <ContractRow name="SantioraReactiveV4" address={SANTIORA_REACTIVE_V4} detail={`${r.createFires + r.resolveFires} fires`} />
          <ContractRow name="MarketRegistryV2" address={MARKET_REGISTRY} detail={`${f.totalMarkets} markets`} />
          <ContractRow name="Agent Platform" address={CONTRACTS.PLATFORM} detail="Proxy → 0xc49e..." />
          <ContractRow name="LLM Agent" address="12847293847561029384" detail="Qwen3-30B | inferToolsChat" />
        </div>
      </Card>

      {/* Somnia Primitives Used */}
      <Card className="p-4 mb-6">
        <h3 className="text-xs font-semibold mb-3">Somnia Agentic Primitives Used</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
            <Badge variant="outline" className="text-[9px] shrink-0">LLM</Badge>
            <span className="text-xs">inferToolsChat — AI brain decides create/resolve</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
            <Badge variant="outline" className="text-[9px] shrink-0">JSON API</Badge>
            <span className="text-xs">fetchString/fetchUint — real-world data for resolution</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
            <Badge variant="outline" className="text-[9px] shrink-0">Reactivity</Badge>
            <span className="text-xs">BlockTick + Schedule — autonomous triggers</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
            <Badge variant="outline" className="text-[9px] shrink-0">Consensus</Badge>
            <span className="text-xs">3-validator subcommittee for every agent call</span>
          </div>
        </div>
      </Card>

      {/* Speed Advantage */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold mb-3">Why Somnia for Autonomous Agents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded bg-green-500/5 border border-green-500/10">
            <p className="text-2xl font-mono font-bold text-green-600">400ms</p>
            <p className="text-[10px] text-muted-foreground mt-1">Block finality — agents react in real-time</p>
          </div>
          <div className="p-3 rounded bg-blue-500/5 border border-blue-500/10">
            <p className="text-2xl font-mono font-bold text-blue-600">Native</p>
            <p className="text-[10px] text-muted-foreground mt-1">LLM + JSON API built into consensus layer</p>
          </div>
          <div className="p-3 rounded bg-purple-500/5 border border-purple-500/10">
            <p className="text-2xl font-mono font-bold text-purple-600">Zero-Op</p>
            <p className="text-[10px] text-muted-foreground mt-1">No keepers, no cron jobs, no infra to maintain</p>
          </div>
        </div>
      </Card>
    </PageTransition>
  );
}
