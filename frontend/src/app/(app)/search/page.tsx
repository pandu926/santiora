"use client";
import { useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  return (
    <PageTransition>
      <PageHeader title="Search" description="Find markets, agents, and more" />
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search markets, agents..." value={query} onChange={e => setQuery(e.target.value)} className="pl-10" />
      </div>
      <div className="mt-8 text-center text-sm text-muted-foreground">
        {query ? `Searching for "${query}"...` : "Type to search markets and agents"}
      </div>
    </PageTransition>
  );
}
