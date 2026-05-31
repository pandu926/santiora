export default function EmbedPage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-mono">Santiora</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">crypto</span>
        </div>
        <h3 className="text-sm font-medium mb-3">Will Bitcoin exceed $150,000 by end of 2026?</h3>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-destructive/20 mb-2">
          <div className="bg-success rounded-full" style={{ width: "42%" }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-success font-mono font-medium">YES 42%</span>
          <span className="text-destructive font-mono font-medium">NO 58%</span>
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between text-[10px] text-muted-foreground">
          <span>Vol: 12,450 STT</span>
          <a href="https://santiora.rbexp.com" target="_blank" className="text-primary hover:underline">
            Trade on Santiora
          </a>
        </div>
      </div>
    </div>
  );
}
