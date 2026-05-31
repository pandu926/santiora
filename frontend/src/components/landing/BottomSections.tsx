"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bitcoin,
  Landmark,
  Trophy,
  Cpu,
  Film,
  FlaskConical,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { TimelineSvg, CodeSvg } from "@/components/svg/illustrations";
import { useCountUp } from "@/hooks/useAnime";

/* ─────────────────────────────────────────────
   Section 6 — Live Stats
   ───────────────────────────────────────────── */

function LiveStats() {
  const contractsRef = useRef<HTMLSpanElement>(null);
  const agentsRef = useRef<HTMLSpanElement>(null);
  const primitivesRef = useRef<HTMLSpanElement>(null);
  const operatorsRef = useRef<HTMLSpanElement>(null);

  useCountUp(contractsRef, 15, 2200);
  useCountUp(agentsRef, 10, 2000);
  useCountUp(primitivesRef, 10, 1800);
  useCountUp(operatorsRef, 0, 800);

  const stats = [
    { ref: contractsRef, suffix: "+", label: "Smart Contracts" },
    { ref: agentsRef, suffix: "+", label: "AI Agents" },
    { ref: primitivesRef, suffix: "/10", label: "Somnia Primitives" },
    { ref: operatorsRef, suffix: "", label: "Human Operators" },
  ];

  return (
    <section className="bg-zinc-900 text-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        <h2
          className="text-center text-3xl md:text-4xl font-bold mb-16 tracking-tight"
          data-anime="fadeUp"
        >
          Protocol at a Glance
        </h2>
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
          data-anime="stagger"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-mono text-5xl md:text-6xl font-bold text-white mb-3">
                <span ref={stat.ref}>0</span>
                {stat.suffix && (
                  <span className="text-zinc-400">{stat.suffix}</span>
                )}
              </div>
              <p className="text-zinc-400 text-sm md:text-base tracking-wide uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Section 7 — Roadmap
   ───────────────────────────────────────────── */

const MILESTONES = [
  {
    quarter: "Q1 2026",
    title: "Core Protocol",
    description: "Smart contracts deployed. AMM pools and resolution engine live on testnet.",
    status: "done" as const,
  },
  {
    quarter: "Q2 2026",
    title: "AI Agents Live",
    description: "Autonomous market creation, odds setting, and liquidity management activated.",
    status: "done" as const,
  },
  {
    quarter: "Q3 2026",
    title: "Public Launch",
    description: "Mainnet deployment. Open access for traders. Real-world event resolution.",
    status: "current" as const,
  },
  {
    quarter: "Q4 2026",
    title: "Cross-chain",
    description: "Bridge integrations. Multi-chain liquidity aggregation and settlement.",
    status: "future" as const,
  },
];

function MilestoneDot({ status }: { status: "done" | "current" | "future" }) {
  if (status === "done") {
    return (
      <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-400 shadow-sm shadow-emerald-500/30" />
    );
  }
  if (status === "current") {
    return (
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-40" />
        <div className="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-400" />
      </div>
    );
  }
  return (
    <div className="w-4 h-4 rounded-full border-2 border-zinc-400 bg-transparent" />
  );
}

function Roadmap() {
  return (
    <section className="bg-white py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-center mb-6" data-anime="fadeIn">
          <TimelineSvg className="w-full max-w-md text-zinc-400" />
        </div>
        <h2
          className="text-center text-3xl md:text-4xl font-bold mb-16 tracking-tight text-zinc-900"
          data-anime="fadeUp"
        >
          Roadmap
        </h2>
        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-8 relative"
          data-anime="stagger"
        >
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-[1.125rem] left-[12.5%] right-[12.5%] h-px bg-zinc-200" />

          {MILESTONES.map((milestone) => (
            <div key={milestone.quarter} className="relative text-center">
              <div className="flex justify-center mb-4">
                <MilestoneDot status={milestone.status} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                {milestone.quarter}
              </p>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">
                {milestone.title}
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {milestone.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Section 8 — Market Categories
   ───────────────────────────────────────────── */

const CATEGORIES = [
  {
    icon: Bitcoin,
    name: "Crypto",
    question: "Will ETH surpass $10k by December?",
  },
  {
    icon: Landmark,
    name: "Politics",
    question: "Who wins the 2026 midterm elections?",
  },
  {
    icon: Trophy,
    name: "Sports",
    question: "Will Argentina win the next World Cup?",
  },
  {
    icon: Cpu,
    name: "Technology",
    question: "Will AGI be announced before 2027?",
  },
  {
    icon: Film,
    name: "Entertainment",
    question: "Which film wins Best Picture at the Oscars?",
  },
  {
    icon: FlaskConical,
    name: "Science",
    question: "Will fusion energy reach net positive this year?",
  },
];

function MarketCategories() {
  return (
    <section className="bg-zinc-50 py-28">
      <div className="max-w-6xl mx-auto px-6">
        <h2
          className="text-center text-3xl md:text-4xl font-bold mb-4 tracking-tight text-zinc-900"
          data-anime="fadeUp"
        >
          Predict Anything
        </h2>
        <p
          className="text-center text-zinc-600 mb-14 max-w-2xl mx-auto"
          data-anime="fadeUp"
          data-anime-delay="100"
        >
          AI agents autonomously create and resolve markets across every domain.
          If it is verifiable, it is tradeable.
        </p>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          data-anime="stagger"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="group border border-zinc-200 rounded-xl p-6 bg-white hover:border-zinc-400 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                    <Icon className="w-5 h-5 text-zinc-700" />
                  </div>
                  <h3 className="font-semibold text-zinc-900">{cat.name}</h3>
                </div>
                <p className="text-sm text-zinc-500 italic leading-relaxed">
                  &ldquo;{cat.question}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Section 9 — For Developers
   ───────────────────────────────────────────── */

const CODE_SAMPLE = `curl -X GET https://api.santiora.io/v1/markets \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "category": "crypto",
    "status": "active",
    "limit": 10
  }'`;

function ForDevelopers() {
  return (
    <section className="bg-white py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div data-anime="slideLeft">
            <CodeSvg className="w-32 h-auto text-zinc-400 mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
              Build on Santiora
            </h2>
            <p className="text-zinc-600 leading-relaxed mb-6 max-w-md">
              Integrate prediction markets into your application with our
              REST API and TypeScript SDK. Create markets, place bets, and
              query resolution data programmatically. Full documentation
              with examples for every endpoint.
            </p>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 border border-zinc-300 rounded-lg px-5 py-2.5 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
            >
              View Documentation
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {/* Right — Code block */}
          <div data-anime="slideRight">
            <div className="rounded-xl border border-zinc-200 bg-zinc-950 overflow-hidden shadow-lg">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <span className="ml-3 text-xs text-zinc-500 font-mono">
                  GET /v1/markets
                </span>
              </div>
              <pre className="p-5 overflow-x-auto text-sm leading-relaxed">
                <code className="text-emerald-400 font-mono whitespace-pre">
                  {CODE_SAMPLE}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Section 10 — Final CTA + Footer
   ───────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="bg-zinc-900 py-28">
      <div className="max-w-6xl mx-auto px-6 text-center" data-anime="fadeUp">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
          Ready to predict the future?
        </h2>
        <p className="text-zinc-400 mb-10 max-w-lg mx-auto text-lg">
          No middlemen. No operators. Just you and the market.
        </p>
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 bg-white text-zinc-900 font-semibold px-8 py-4 rounded-xl hover:bg-zinc-100 transition-colors text-base"
        >
          Launch App
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/santiora" },
  { label: "Discord", href: "https://discord.gg/santiora" },
];

function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + year */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo-santiora.png"
              alt="Santiora"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="text-zinc-400 text-sm font-medium">
              Santiora 2026
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Built on Somnia badge */}
          <div className="flex items-center gap-2 border border-zinc-800 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-500 font-medium">
              Built on Somnia
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   Default Export
   ───────────────────────────────────────────── */

export default function BottomSections() {
  return (
    <>
      <LiveStats />
      <Roadmap />
      <MarketCategories />
      <ForDevelopers />
      <FinalCta />
      <Footer />
    </>
  );
}
