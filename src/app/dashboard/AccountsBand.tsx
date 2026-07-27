"use client";

import Link from "next/link";
import { formatCurrency, isPropAccount, accountTradingPnl, type Account } from "@/lib/demo-data";
import {
  AccountTypePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
} from "@/app/trading/accounts/AccountDrawerContent";
import { useRevealOnScroll } from "./useRevealOnScroll";

// ─── Compact account row ──────────────────────────────────────────────────────
// Same fields and both progress-bar branches as page.tsx's original
// AccountSnapshotRow, given more room per row (larger padding/type) per Band 4.

function AccountSnapshotRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const { pct: goalPct } = calcGoalProgress(account);
  const { pctUsed: ddPct } = calcDrawdown(account);
  const ddColor = ddPct >= 80 ? "var(--lucid-neg)" : ddPct >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  const isPassed = account.status === "Passed";

  return (
    <button
      onClick={onClick}
      className="lx-card lx-card-compact lx-card-interactive w-full text-left"
      style={{ cursor: "pointer" }}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <AccountTypePill type={account.account_type} />
          <span className="truncate" style={{ fontSize: 12.5, color: "var(--lucid-ink-2)" }}>{account.account_name}</span>
        </div>
        <StatusPill status={account.status} />
      </div>

      <div className="flex items-baseline gap-3 mb-5">
        <span className="lx-metric" style={{ color: pnlColor }}>
          {formatCurrency(account.current_balance)}
        </span>
        <span className="lx-value" style={{ color: pnlColor }}>
          {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
      </div>

      {/* Progress bars — prop shows target + drawdown; personal shows goal if set */}
      {prop ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>Target</span>
            <div style={{ flex: 1, height: 5, background: "var(--lucid-surface-3)", borderRadius: 3, overflow: "hidden" }}>
              <div className="lt-bar lt-bar-gold" style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", borderRadius: 3 }} />
            </div>
            <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>{isPassed ? "✓" : `${goalPct.toFixed(0)}%`}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>DD</span>
            <div style={{ flex: 1, height: 5, background: "var(--lucid-surface-3)", borderRadius: 3, overflow: "hidden" }}>
              <div className="lt-bar" style={{ width: `${ddPct}%`, height: "100%", background: ddColor, borderRadius: 3 }} />
            </div>
            <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>{ddPct.toFixed(0)}%</span>
          </div>
        </div>
      ) : hasGoal ? (
        <div className="flex items-center gap-2">
          <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>Goal</span>
          <div style={{ flex: 1, height: 5, background: "var(--lucid-surface-3)", borderRadius: 3, overflow: "hidden" }}>
            <div className="lt-bar lt-bar-gold" style={{ width: `${goalPct}%`, height: "100%", borderRadius: 3 }} />
          </div>
          <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>{goalPct.toFixed(0)}%</span>
        </div>
      ) : null}
    </button>
  );
}

// ─── Band 4 — Accounts ────────────────────────────────────────────────────────
// Same fields, both progress bars, "View all" link, empty-state copy, and row
// click (opens the account drawer) as the old two-column strip's right card —
// full width now, with more room per row.

export function AccountsBand({
  allAccounts,
  onAccountClick,
  reducedMotion,
}: {
  allAccounts: Account[];
  onAccountClick: (a: Account) => void;
  reducedMotion: boolean;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className={`${revealed && !reducedMotion ? "lt-rise" : revealed ? "" : "opacity-0"}`}
    >
      <div className="lx-band-head flex items-end justify-between gap-4">
        <div>
          <div className="lx-eyebrow">Capital</div>
          <h2 className="lx-heading">Accounts</h2>
        </div>
        <Link
          href="/trading/accounts"
          className="lx-micro shrink-0"
          style={{ textDecoration: "none" }}
        >
          View all →
        </Link>
      </div>

      {allAccounts.length === 0 ? (
        <div className="lx-card">
          <p className="lx-body">No accounts yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="lx-grid-metrics" style={{ "--lx-cols": 2 } as React.CSSProperties}>
          {allAccounts.map((account) => (
            <AccountSnapshotRow
              key={account.id}
              account={account}
              onClick={() => onAccountClick(account)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
