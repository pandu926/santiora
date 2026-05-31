"use client";

import dynamic from "next/dynamic";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false, loading: () => <WalletPlaceholder /> }
);

function WalletPlaceholder() {
  return (
    <button className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold">
      Connect Wallet
    </button>
  );
}

export function Header() {
  return (
    <header className="border-b border-[var(--border)] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-green)] flex items-center justify-center font-bold text-black text-sm">A</div>
          <h1 className="text-xl font-bold">Santiora</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-purple)] text-white">AI-Operated</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-[var(--text-secondary)]">
          <a href="/" className="text-[var(--text-primary)]">Markets</a>
          <a href="/portfolio">Portfolio</a>
          <a href="/ai-activity">AI Activity</a>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-green)] pulse"></div>
            <span className="text-xs">AI Active</span>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </nav>
      </div>
    </header>
  );
}
