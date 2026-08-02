"use client";

import Link from "next/link";
import { formatCurrency, isPropAccount, accountTradingPnl, type Account } from "@/lib/demo-data";
import { capitalRole } from "@/lib/account-capital";
import {
  AccountTypePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
} from "@/app/trading/accounts/AccountDrawerContent";
import { useRevealOnScroll } from "./useRevealOnScroll";

// ─── Band 6 — Capital ────────────────────────────────────────────────────────
// Three-up cards. Evaluation accounts render recessed — transparent fill, no
// inner highlight, reduced opacity, an EVAL chip — so managed capital is the
// only thing on the band that looks solid and challenge capital reads as
// provisional. "Evaluation" is not decided here: it comes from capitalRole(),
// the existing single source of truth the hero's own totals are built on.
//
// Every field, both progress-bar branches, the status pill, the "View all"
// link, the empty-state copy and the drawer click are unchanged.

function AccountCard({ account, onClick }: { account: Account; onClick: () => void }) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const { pct: goalPct } = calcGoalProgress(account);
  const { pctUsed: ddPct } = calcDrawdown(account);
  const ddColor = ddPct >= 80 ? "var(--lucid-neg)" : ddPct >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  const isPassed = account.status === "Passed";
  const isEval = capitalRole(account) === "evaluation";

  return (
    <button
      onClick={onClick}
      className={`lx-card lx-card-compact dash-acct ${isEval ? "dash-acct-eval" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <AccountTypePill type={account.account_type} />
          <div
            className="truncate"
            style={{ fontSize: 16, color: "var(--lucid-ink)", marginTop: 9 }}
          >
            {account.account_name}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEval && (
            <span
              className="pill"
              style={{
                fontFamily: "var(--lucid-font-mono)",
                fontSize: 8.5,
                letterSpacing: "0.14em",
                color: "var(--lucid-ink-3)",
                border: "1px solid var(--lucid-line)",
                background: "transparent",
              }}
            >
              EVAL
            </span>
          )}
          <StatusPill status={account.status} />
        </div>
      </div>

      <div
        className="lx-tnum"
        style={{
          fontFamily: "var(--lucid-font-mono)",
          fontSize: 28,
          fontWeight: 300,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginTop: 20,
          color: "var(--lucid-ink)",
        }}
      >
        {formatCurrency(account.current_balance)}
      </div>
      <div className="lx-value" style={{ color: pnlColor, marginTop: 6 }}>
        {pnl >= 0 ? "+" : ""}
        {pnlPct.toFixed(2)}%
      </div>

      {/* Progress bars — prop shows target + drawdown; personal shows goal if set */}
      <div style={{ marginTop: 20 }}>
        {prop ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>Target</span>
              <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
                <div className="lt-bar lt-bar-gold" style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", borderRadius: 4 }} />
              </div>
              <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>
                {isPassed ? "✓" : `${goalPct.toFixed(0)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>DD</span>
              <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
                <div className="lt-bar" style={{ width: `${ddPct}%`, height: "100%", background: ddColor, borderRadius: 4 }} />
              </div>
              <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>
                {ddPct.toFixed(0)}%
              </span>
            </div>
          </div>
        ) : hasGoal ? (
          <div className="flex items-center gap-2">
            <span className="lx-micro" style={{ width: 40, flexShrink: 0 }}>Goal</span>
            <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
              <div className="lt-bar lt-bar-gold" style={{ width: `${goalPct}%`, height: "100%", borderRadius: 4 }} />
            </div>
            <span className="lx-micro" style={{ width: 32, textAlign: "right", flexShrink: 0 }}>
              {goalPct.toFixed(0)}%
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

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
      <div className="dash-head">
        <div>
          {/* Heading text is the one it has always been — the redesign changes
              the card treatment, not the page's vocabulary. */}
          <div className="lx-eyebrow">Capital</div>
          <h2 className="dash-title">Accounts</h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {allAccounts.map((account) => (
            <AccountCard
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
