"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs-nav";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DocsPagination() {
  const pathname = usePathname();

  const currentSlug = pathname === "/docs" ? "" : pathname.replace("/docs/", "");
  const currentIndex = DOCS_NAV.findIndex((item) => item.slug === currentSlug);

  const prev = currentIndex > 0 ? DOCS_NAV[currentIndex - 1] : null;
  const next = currentIndex < DOCS_NAV.length - 1 ? DOCS_NAV[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t">
      {prev ? (
        <Link
          href={prev.slug ? `/docs/${prev.slug}` : "/docs"}
          className="group flex items-center gap-2 px-4 py-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">Previous</p>
            <p className="text-sm font-medium group-hover:text-primary transition-colors">{prev.title}</p>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.slug ? `/docs/${next.slug}` : "/docs"}
          className="group flex items-center gap-2 px-4 py-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors"
        >
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Next</p>
            <p className="text-sm font-medium group-hover:text-primary transition-colors">{next.title}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
