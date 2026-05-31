"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <PageTransition>
      <PageHeader title="API Keys" description="Oracle API access management" action={<Button size="sm"><Key className="w-3.5 h-3.5 mr-1.5" />Create Key</Button>} />
      <Card>
        <div className="grid grid-cols-[1fr_100px_100px_60px] items-center px-4 py-2 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Key</span><span>Created</span><span>Last Used</span><span>Status</span>
        </div>
        <div className="grid grid-cols-[1fr_100px_100px_60px] items-center px-4 py-3">
          <span className="font-mono text-xs">aa_sk_****...7f2a</span>
          <span className="text-xs text-muted-foreground">May 25</span>
          <span className="text-xs text-muted-foreground">May 28</span>
          <Badge className="text-[10px] w-fit">Active</Badge>
        </div>
      </Card>
    </PageTransition>
  );
}
