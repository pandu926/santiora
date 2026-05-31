"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, Bot, Wallet, BarChart3, Search, Trophy, Layers, Zap, Eye, Activity, BookOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { SpeedTicker } from "@/components/shared/TxConfirmationOverlay";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((m) => m.ConnectButton),
  { ssr: false, loading: () => <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" /> }
);

const navItems = [
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/ai", label: "AI", icon: Bot, children: [
    { href: "/ai", label: "Dashboard" },
    { href: "/ai/agents", label: "Agent Arena" },
    { href: "/ai/self-betting", label: "AI Self-Betting" },
    { href: "/ai/resolver", label: "Resolver" },
  ]},
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/oracle", label: "Oracle", icon: Zap, children: [
    { href: "/oracle", label: "Overview" },
    { href: "/oracle/playground", label: "Playground" },
  ]},
  { href: "/meta-markets", label: "Meta", icon: Layers },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-santiora.png" alt="Santiora" className="w-7 h-7 rounded-md" />
            <span className="font-semibold text-sm hidden sm:block">Santiora</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
                {item.children && (
                  <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50">
                    <div className="bg-card border rounded-lg shadow-lg py-1 min-w-[160px]">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block px-3 py-2 text-xs transition-colors",
                            pathname === child.href ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <SpeedTicker />
          <Link href="/transparency" className="p-2 rounded-md hover:bg-muted text-muted-foreground hidden sm:block" title="Transparency">
            <Eye className="w-4 h-4" />
          </Link>
          <Link href="/search" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <Search className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
            <span className="text-[10px] text-muted-foreground hidden sm:block">Live</span>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
