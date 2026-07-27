"use client";

import { Sparkles, ArrowRight, Plus, ArrowLeftRight, ClipboardList, Radar } from "lucide-react";

// ─── Below-the-fold band — Quick Actions + chat bar (Step 6) ──────────────────
// Moved out of the hero verbatim (same icons, labels, descriptions, action
// handlers, chat placeholder, Enter-key submit, and "Coming in Phase 3"
// footer copy) so the first screen stays clean, per B2's explicit instruction.
// Nothing here is new copy or new behaviour.

export function QuickActionsBand({
  chatValue,
  onChatChange,
  onChatSubmit,
  onLogTrade,
  onCashFlow,
  onViewPlanned,
  onOpenScanner,
}: {
  chatValue: string;
  onChatChange: (v: string) => void;
  onChatSubmit: () => void;
  onLogTrade: () => void;
  onCashFlow: () => void;
  onViewPlanned: () => void;
  onOpenScanner: () => void;
}) {
  const quickActions = [
    { icon: <Plus size={20} />, label: "Log Trade", desc: "Record a new position", action: onLogTrade },
    { icon: <ArrowLeftRight size={20} />, label: "Cash Flow", desc: "Deposit, withdrawal or payout", action: onCashFlow },
    { icon: <ClipboardList size={20} />, label: "View Planned", desc: "Review your setup watchlist", action: onViewPlanned },
    { icon: <Radar size={20} />, label: "Open Scanner", desc: "Top setups and scores", action: onOpenScanner },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-6 lg:gap-8">
      {/* Quick Actions */}
      <div>
        <div className="lx-band-head">
          <div className="lx-eyebrow">Quick Actions</div>
          <h2 className="lx-heading">Do something</h2>
        </div>
        <div className="lx-grid-metrics">
          {quickActions.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="lx-card lx-card-compact lx-card-interactive text-left"
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center gap-3">
                <span className="lt-chip">{item.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--lucid-ink)", lineHeight: 1.2 }}>{item.label}</p>
                  <p className="lx-micro" style={{ marginTop: 3 }}>{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lucid chat input bar — exact current behaviour, incl. "Coming in Phase 3" */}
      <div>
        <div className="lx-band-head">
          <div className="lx-eyebrow">Ask Lucid</div>
          <h2 className="lx-heading">Your assistant</h2>
        </div>
        <div className="lt-chatbar rounded-xl flex items-center gap-3 px-4" style={{ height: 56 }}>
          <Sparkles size={18} style={{ color: "var(--lucid-accent)", flexShrink: 0 }} />
          <input
            value={chatValue}
            onChange={(e) => onChatChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onChatSubmit(); }}
            placeholder="Ask Lucid anything about your trading..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--lucid-ink)", caretColor: "var(--lucid-accent)" } as React.CSSProperties}
          />
          <button
            onClick={onChatSubmit}
            className="lt-btn-gold flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, flexShrink: 0 }}
          >
            <ArrowRight size={16} style={{ color: "var(--lucid-bg)" }} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginTop: 10 }}>
          <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)", fontSize: 10, marginRight: 6 }}>
            Phase 3
          </span>
          Lucid AI activates with full context of your trading system.
        </p>
      </div>
    </div>
  );
}
