"use client";

// ─── Band 1 — Quick strip ────────────────────────────────────────────────────
// Deliberately not a band: a thin bar whose whole job is to make the heavy
// band beneath it read as heavy. The four Quick Actions become compact
// buttons, and the chat bar sits directly under them, full width and slim.
//
// Every label, every handler, the Enter-key submit, the Phase 3 pill and its
// copy are the ones that were here before — only their geometry changed. The
// per-action descriptions ("Record a new position" etc.) survive as each
// button's title/aria description, since a compact row has no room for a
// second line but the information should not be lost.

import { Sparkles, ArrowRight } from "lucide-react";

export function QuickStrip({
  chatValue,
  onChatChange,
  onChatSubmit,
  onLogTrade,
  onCashFlow,
  onViewPlanned,
  onOpenScanner,
  tradesThisMonth,
}: {
  chatValue: string;
  onChatChange: (v: string) => void;
  onChatSubmit: () => void;
  onLogTrade: () => void;
  onCashFlow: () => void;
  onViewPlanned: () => void;
  onOpenScanner: () => void;
  tradesThisMonth: number;
}) {
  const actions = [
    { label: "Log Trade", desc: "Record a new position", action: onLogTrade, primary: true },
    { label: "Cash Flow", desc: "Deposit, withdrawal or payout", action: onCashFlow, primary: false },
    { label: "View Planned", desc: "Review your setup watchlist", action: onViewPlanned, primary: false },
    { label: "Open Scanner", desc: "Top setups and scores", action: onOpenScanner, primary: false },
  ];

  return (
    <div>
      {/* The strip has no visible headings — that is what makes it a strip
          rather than a band. The two section names the old layout showed
          ("Quick Actions", "Ask Lucid") survive as the accessible names of the
          two groups, so nothing is lost to a screen reader. */}
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Quick Actions">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.action}
            title={a.desc}
            aria-label={`${a.label} — ${a.desc}`}
            className={`lx-btn ${a.primary ? "lx-btn-primary" : "lx-btn-secondary"}`}
            style={{ height: 34, paddingInline: 16, fontSize: 11.5 }}
          >
            {a.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="lx-micro lx-tnum" style={{ letterSpacing: "0.14em", whiteSpace: "nowrap" }}>
          {tradesThisMonth} {tradesThisMonth === 1 ? "TRADE" : "TRADES"} THIS MONTH
        </span>
      </div>

      {/* Chat bar — same behaviour, same Phase 3 response, still not functional. */}
      <div
        className="lt-chatbar rounded-xl flex items-center gap-3 px-4"
        style={{ height: 48, marginTop: 12 }}
        role="group"
        aria-label="Ask Lucid"
      >
        <Sparkles size={16} style={{ color: "var(--lucid-accent)", flexShrink: 0 }} />
        <input
          value={chatValue}
          onChange={(e) => onChatChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChatSubmit();
          }}
          placeholder="Ask Lucid anything about your trading..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--lucid-ink)", caretColor: "var(--lucid-accent)" } as React.CSSProperties}
        />
        <span
          className="pill hidden sm:inline-flex"
          style={{
            background: "var(--lucid-surface-3)",
            color: "var(--lucid-ink-2)",
            border: "1px solid var(--lucid-line-2)",
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          Phase 3
        </span>
        <button
          onClick={onChatSubmit}
          aria-label="Ask Lucid"
          className="lt-btn-gold flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, flexShrink: 0 }}
        >
          <ArrowRight size={15} style={{ color: "var(--lucid-bg)" }} />
        </button>
      </div>
      <p className="lx-micro" style={{ marginTop: 8 }}>
        Lucid AI activates with full context of your trading system.
      </p>
    </div>
  );
}
