"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DOCS_NAV } from "@/lib/docs-nav";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
        Documentation
      </p>
      {DOCS_NAV.map((item) => {
        const href = item.slug ? `/docs/${item.slug}` : "/docs";
        const isActive = item.slug
          ? pathname === `/docs/${item.slug}`
          : pathname === "/docs";

        return (
          <Link
            key={item.slug}
            href={href}
            className={cn(
              "block px-3 py-1.5 rounded-md text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
