"use client";

import { useState } from "react";
import { TrendingUp, Plus, CheckCircle, X } from "lucide-react";
import Link from "next/link";

interface ToastItem {
  id: string;
  icon: "new_market" | "bet" | "resolved";
  message: string;
  link?: string;
}

function ToastIcon({ type }: { type: ToastItem["icon"] }) {
  switch (type) {
    case "new_market":
      return <Plus className="h-4 w-4 text-emerald-400 shrink-0" />;
    case "bet":
      return <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />;
    case "resolved":
      return <CheckCircle className="h-4 w-4 text-amber-400 shrink-0" />;
  }
}

export function LiveFeed() {
  const [toasts] = useState<ToastItem[]>([]);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5" aria-live="polite">
        <div
          className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"
          title="On-chain: connected"
          role="status"
          aria-label="Reading from Somnia chain"
        />
        <span className="text-[10px] text-emerald-400/70 font-mono">on-chain</span>
      </div>

      <div
        className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none md:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-zinc-900/95 border border-zinc-700/50 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow-lg animate-in slide-in-from-right-full duration-300 flex items-start gap-2.5"
            role="alert"
          >
            <ToastIcon type={toast.icon} />
            <div className="flex-1 min-w-0">
              {toast.link ? (
                <Link
                  href={toast.link}
                  className="text-sm text-zinc-200 hover:text-white transition-colors line-clamp-2"
                >
                  {toast.message}
                </Link>
              ) : (
                <p className="text-sm text-zinc-200 line-clamp-2">{toast.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
