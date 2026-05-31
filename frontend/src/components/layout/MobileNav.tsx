"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, Bot, Wallet, Activity, Trophy } from "lucide-react";

const mobileNavItems = [
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/leaderboard", label: "Rank", icon: Trophy },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-sm">
      <div className="flex justify-around py-2">
        {mobileNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors",
              pathname.startsWith(item.href)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
