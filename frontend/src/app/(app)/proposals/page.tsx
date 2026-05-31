"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export default function ProposalsPage() {
  return (
    <PageTransition>
      <PageHeader title="Market Proposals" description="Suggest markets for AI to create" />
      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Input placeholder="Suggest a prediction market question..." className="text-sm" />
          <Button size="sm">Submit</Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Proposals are reviewed by AI agents. Popular suggestions get created as markets.</p>
      </Card>
      <div className="text-center py-12">
        <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No proposals yet. Be the first to suggest a market!</p>
      </div>
    </PageTransition>
  );
}
