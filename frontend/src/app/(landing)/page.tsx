"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Cpu, Globe, FileJson, Radio, Fingerprint, Bot, Sparkles, BarChart3, Shield, Lock, Eye } from "lucide-react";
import { NetworkSvg, BrainSvg, ShieldSvg, ChartSvg } from "@/components/svg/illustrations";
import { useScrollAnime, useCountUp } from "@/hooks/useAnime";
import BottomSections from "@/components/landing/BottomSections";

// --- Section 1: Hero ---

function HeroSection() {
  const contractsRef = useRef<HTMLSpanElement>(null);
  const agentsRef = useRef<HTMLSpanElement>(null);
  const operatorsRef = useRef<HTMLSpanElement>(null);

  useCountUp(contractsRef, 15, 2000);
  useCountUp(agentsRef, 10, 2000);
  useCountUp(operatorsRef, 0, 1000);

  return (
    <section className="relative overflow-hidden py-16 md:py-20 px-4">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <NetworkSvg className="w-[800px] h-[600px] text-primary/20" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        <h1
          data-anime="fadeUp"
          data-anime-delay="100"
          className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          The World&apos;s First{" "}
          <span className="text-primary">Fully Autonomous</span>{" "}
          Prediction Market
        </h1>

        <p
          data-anime="fadeUp"
          data-anime-delay="200"
          className="mt-4 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto"
        >
          AI creates, resolves, and operates markets entirely on-chain. Zero human intervention. Powered by Somnia Agentic L1.
        </p>

        <div
          data-anime="fadeUp"
          data-anime-delay="350"
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-7 py-3.5 text-sm font-semibold hover:bg-muted/60 transition-colors"
          >
            Read Docs
          </Link>
        </div>

        <div
          data-anime="fadeUp"
          data-anime-delay="500"
          className="mt-16 flex items-center justify-center gap-8 md:gap-14"
        >
          <StatItem refProp={contractsRef} label="Contracts" />
          <div className="w-px h-10 bg-border" />
          <StatItem refProp={agentsRef} label="AI Agents" />
          <div className="w-px h-10 bg-border" />
          <StatItem refProp={operatorsRef} label="Human Operators" />
        </div>
      </div>
    </section>
  );
}

function StatItem({ refProp, label }: { refProp: React.RefObject<HTMLSpanElement | null>; label: string }) {
  return (
    <div className="text-center">
      <span ref={refProp} className="block text-3xl md:text-4xl font-bold font-mono tabular-nums">
        0
      </span>
      <span className="text-xs text-muted-foreground mt-1 block">{label}</span>
    </div>
  );
}

// --- Section 2: How It Works ---

const HOW_IT_WORKS_STEPS = [
  {
    icon: BrainSvg,
    title: "AI Scans News",
    description:
      "Autonomous agents monitor global news feeds, social media, and data sources to detect trending events worth betting on.",
  },
  {
    icon: ChartSvg,
    title: "Creates Market",
    description:
      "AI formulates clear yes/no questions, sets initial odds using probability analysis, and deploys the market contract on-chain.",
  },
  {
    icon: ShieldSvg,
    title: "Resolves Outcome",
    description:
      "Three AI validators independently verify real-world outcomes. Consensus at 80%+ confidence triggers trustless settlement.",
  },
];

function HowItWorksSection() {
  return (
    <section className="py-24 bg-muted/30 px-4">
      <div className="max-w-6xl mx-auto">
        <h2
          data-anime="fadeUp"
          className="text-center text-sm uppercase tracking-widest text-muted-foreground mb-14 font-medium"
        >
          How It Works
        </h2>

        <div data-anime="stagger" className="grid md:grid-cols-3 gap-10">
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="text-center group">
                <div className="w-16 h-16 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/12 transition-colors">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-semibold text-base">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- Section 3: Technology ---

const TECH_PRIMITIVES = [
  {
    icon: Cpu,
    title: "LLM Inference",
    description: "On-chain AI reasoning for market creation and resolution",
  },
  {
    icon: Globe,
    title: "Web Scraper",
    description: "Real-time data extraction from news and event sources",
  },
  {
    icon: FileJson,
    title: "JSON API",
    description: "Structured data feeds for odds calculation and verification",
  },
  {
    icon: Radio,
    title: "Reactive Subscriptions",
    description: "Event-driven triggers for market lifecycle management",
  },
  {
    icon: Fingerprint,
    title: "Deterministic Consensus",
    description: "Reproducible AI outputs across validator nodes",
  },
  {
    icon: Bot,
    title: "Agent Self-Betting",
    description: "AI agents stake on their own confidence to align incentives",
  },
];

function TechnologySection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2
          data-anime="fadeUp"
          className="text-2xl md:text-3xl font-bold text-center mb-4"
        >
          Built on Somnia Agentic L1
        </h2>
        <p
          data-anime="fadeUp"
          data-anime-delay="100"
          className="text-center text-muted-foreground text-sm mb-14 max-w-lg mx-auto"
        >
          Leveraging all native agentic primitives for fully autonomous operation
        </p>

        <div data-anime="stagger" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TECH_PRIMITIVES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/60 bg-card/50 p-5 hover:border-primary/20 hover:bg-card transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- Section 4: AI Agents ---

const AI_AGENTS = [
  {
    name: "Market Creator",
    description:
      "Scans news feeds and social signals to identify high-interest events, then autonomously deploys prediction market contracts with calibrated initial odds.",
  },
  {
    name: "Market Resolver",
    description:
      "Monitors real-world outcomes through multiple data sources. Three independent resolver instances must reach consensus before triggering settlement.",
  },
  {
    name: "Liquidity Manager",
    description:
      "Maintains healthy AMM pools by adjusting depth based on market activity, time-to-resolution, and volatility signals.",
  },
  {
    name: "Self-Betting Agent",
    description:
      "Stakes protocol funds on markets where AI confidence exceeds threshold, aligning agent incentives with accurate predictions.",
  },
];

function AIAgentsSection() {
  return (
    <section className="py-24 bg-muted/30 px-4">
      <div className="max-w-6xl mx-auto">
        <h2
          data-anime="fadeUp"
          className="text-2xl md:text-3xl font-bold text-center mb-4"
        >
          Autonomous AI Agents
        </h2>
        <p
          data-anime="fadeUp"
          data-anime-delay="100"
          className="text-center text-muted-foreground text-sm mb-14 max-w-lg mx-auto"
        >
          Each agent operates independently with no human oversight or intervention
        </p>

        <div data-anime="stagger" className="grid sm:grid-cols-2 gap-6">
          {AI_AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="rounded-xl border border-border/60 bg-card/80 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0">
                  <BrainSvg className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-2">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Section 5: Security & Trust ---

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "No Admin Keys",
    description: "Contracts are fully immutable with no owner privileges or upgrade paths",
  },
  {
    icon: Shield,
    title: "Immutable Contracts",
    description: "Deployed code cannot be modified, paused, or self-destructed by anyone",
  },
  {
    icon: Sparkles,
    title: "AI Consensus (3 Validators)",
    description: "Three independent AI agents must agree before any market resolves",
  },
  {
    icon: Eye,
    title: "Fully Transparent",
    description: "Every decision, bet, and resolution is recorded on-chain and publicly verifiable",
  },
];

function SecuritySection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div data-anime="slideLeft" className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
              <ShieldSvg className="w-48 h-56 md:w-56 md:h-64 text-primary relative" />
            </div>
          </div>

          <div>
            <h2
              data-anime="fadeUp"
              className="text-2xl md:text-3xl font-bold mb-10"
            >
              Security & Trust
            </h2>

            <div data-anime="stagger" className="space-y-6">
              {TRUST_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm mb-1">{point.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Main Page ---

export default function LandingPage() {
  useScrollAnime();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-santiora.png"
              alt="Santiora"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-base">Santiora</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Launch App
            </Link>
          </div>
        </div>
      </header>

      <main>
        <HeroSection />
        <HowItWorksSection />
        <TechnologySection />
        <AIAgentsSection />
        <SecuritySection />
        <BottomSections />
      </main>

      <footer className="border-t py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>Santiora 2026 - AI-Operated, Zero Human</span>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link href="/transparency" className="hover:text-foreground transition-colors">
              Transparency
            </Link>
            <Link href="/markets" className="hover:text-foreground transition-colors">
              Markets
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
