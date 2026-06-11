"use client";

import {
  type Account,
  type Trade,
  type Payout,
  type AccountType,
  pairs,
  formatCurrency,
  formatDate,
  isPropAccount,
  accountSource,
  accountTypeLabel,
  accountTradingPnl,
  ACCOUNT_TYPE_COLORS,
} from "@/lib/demo-data";

// ── Shared helpers ────────────────────────────────────────────────────────────

// Drawdown tracks realized trading losses (not equity dips from withdrawals/
// payouts), so prop drawdown stays meaningful under the full-equity model.
export function calcDrawdown(account: Account) {
  const ddPct = account.max_drawdown_pct ?? 0;
  const drawdownUsed = Math.max(0, -accountTradingPnl(account));
  const drawdownLimit = (account.account_size * ddPct) / 100;
  const pctUsed = drawdownLimit > 0 ? Math.min(100, (drawdownUsed / drawdownLimit) * 100) : 0;
  return { drawdownUsed, drawdownLimit, pctUsed };
}

// Falls back across prop profit_target_pct → personal profit_goal_pct so the
// same bar renders a firm-set target or a user-set goal depending on type.
// Progress is measured against realized trading P&L, not equity (deposits don't
// count toward a profit target).
export function calcGoalProgress(account: Account, targetPct?: number) {
  const pctTarget = targetPct ?? account.profit_target_pct ?? account.profit_goal_pct ?? 0;
  const profitAchieved = Math.max(0, accountTradingPnl(account));
  const profitTarget = (account.account_size * pctTarget) / 100;
  const pct = profitTarget > 0 ? Math.min(100, (profitAchieved / profitTarget) * 100) : 0;
  return { profitAchieved, profitTarget, pct };
}

export function calcAccountStats(accountTrades: Trade[]) {
  const closedTrades = accountTrades.filter(t => t.date_closed);
  const wins = closedTrades.filter(t => t.blended_rr > 0);
  const losses = closedTrades.filter(t => t.blended_rr < 0);
  const denominator = wins.length + losses.length;
  const winRate = denominator > 0 ? (wins.length / denominator) * 100 : 0;
  const netPnl = closedTrades.reduce((sum, t) => sum + t.blended_pnl, 0);
  const avgPnl = closedTrades.length > 0 ? netPnl / closedTrades.length : 0;

  const pairPnl: Record<string, number> = {};
  closedTrades.forEach(t => {
    pairPnl[t.pair] = (pairPnl[t.pair] ?? 0) + t.blended_pnl;
  });
  const pairEntries = Object.entries(pairPnl);
  const bestPair = pairEntries.length > 0
    ? pairEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
    : "—";
  const worstPair = pairEntries.length > 1
    ? pairEntries.reduce((a, b) => a[1] < b[1] ? a : b)[0]
    : "—";

  return { tradeCount: accountTrades.length, winRate, avgPnl, bestPair, worstPair };
}

// ── Pill components ───────────────────────────────────────────────────────────

export function StagePill({ stage }: { stage: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "Stage 1": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    "Stage 2": { bg: "rgba(168,85,247,0.15)", color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    "Funded":  { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.25)" },
    "Blown":   { bg: "rgba(239,68,68,0.1)",   color: "#EF4444", border: "rgba(239,68,68,0.25)" },
  };
  const s = map[stage] ?? map["Stage 1"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {stage}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "Active": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    "Passed": { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.25)" },
    "Blown":  { bg: "rgba(239,68,68,0.1)",   color: "#EF4444", border: "rgba(239,68,68,0.25)" },
    "Closed": { bg: "rgba(148,163,184,0.12)", color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const s = map[status] ?? map["Active"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

/** Account-type pill: Personal (blue), Demo (gray), Prop Firm (indigo/purple). */
export function AccountTypePill({ type }: { type: AccountType }) {
  const color = ACCOUNT_TYPE_COLORS[type];
  return (
    <span className="pill" style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
      {accountTypeLabel(type)}
    </span>
  );
}

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP:           { bg: "var(--positive-bg)", color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    "Partial+TP": { bg: "var(--positive-bg)", color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    SL:           { bg: "var(--negative-bg)", color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    "Partial+SL": { bg: "var(--negative-bg)", color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    Manual:       { bg: "var(--warning-bg)", color: "var(--warning)", border: "rgba(245,158,11,0.25)" },
    BE:           { bg: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const s = map[type] ?? map["BE"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10 }}>
      {type}
    </span>
  );
}

// ── Progress bar components ───────────────────────────────────────────────────

function DrawdownBar({ pctUsed }: { pctUsed: number }) {
  const color = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: "rgba(148,163,184,0.15)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pctUsed}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function GoalBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: "rgba(148,163,184,0.15)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "#3B82F6",
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: "#64748B", letterSpacing: "0.08em" }}
    >
      {children}
    </p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-4 ${className ?? ""}`}
      style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.08)" }}
    >
      {children}
    </div>
  );
}

function StatMiniCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-0.5"
      style={{ background: "rgba(15,23,35,0.8)", border: "1px solid rgba(148,163,184,0.07)" }}
    >
      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "#475569" }}>{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AccountDrawerContentProps {
  account: Account;
  accountTrades: Trade[];
  onTradeClick?: (tradeId: string) => void;
}

export function AccountDrawerContent({ account, accountTrades, onTradeClick }: AccountDrawerContentProps) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { tradeCount, winRate, avgPnl, bestPair, worstPair } = calcAccountStats(accountTrades);

  const isPassed = account.status === "Passed";
  const isActive = account.status === "Active";
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";

  const remaining = profitTarget - profitAchieved;
  const fromBlown = drawdownLimit - drawdownUsed;

  // Sort trades: most recent first (by date_closed for closed, date_opened for running)
  const sortedTrades = [...accountTrades]
    .filter(t => t.date_closed)
    .sort((a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime());
  const recentTrades = sortedTrades.slice(0, 5);

  function getPairDisplay(pair: string) {
    return pairs.find(p => p.symbol === pair)?.display_name ?? pair;
  }

  return (
    <div className="flex flex-col gap-4 pb-6">

      {/* ── Section 1: Header ──────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <AccountTypePill type={account.account_type} />
          {prop && account.stage && <StagePill stage={account.stage} />}
          <StatusPill status={account.status} />
        </div>
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>{accountSource(account)}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>
          {account.account_name}
        </p>
        <p style={{ fontSize: 28, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {formatCurrency(account.current_balance)}
        </p>
        <p style={{ fontSize: 13, color: pnlColor, marginTop: 4 }}>
          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
        </p>
      </Card>

      {/* ── Section 2: Targets (prop) / Goal (personal) ──────────────── */}
      {!prop && hasGoal && (
        <Card>
          <SectionTitle>Goal</SectionTitle>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontSize: 12, color: "#94A3B8" }}>Profit Goal</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>
                {goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}
              </span>
            </div>
            <GoalBar pct={goalPct} />
            <div className="flex items-center justify-between mt-1">
              <span style={{ fontSize: 11, color: "#475569" }}>
                {goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal
              </span>
            </div>
          </div>
        </Card>
      )}

      {prop && (
      <Card>
        <SectionTitle>Targets</SectionTitle>

        {/* Profit Target */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Profit Target</span>
            {isPassed ? (
              <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>✓ Passed</span>
            ) : (
              <span style={{ fontSize: 12, color: "#64748B" }}>
                {formatCurrency(remaining)} to go
              </span>
            )}
          </div>
          <GoalBar pct={goalPct} />
          <div className="flex items-center justify-between mt-1">
            <span style={{ fontSize: 11, color: "#475569" }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} target</span>
          </div>
        </div>

        {/* Max Drawdown */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Max Drawdown</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              {formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}
            </span>
          </div>
          <DrawdownBar pctUsed={pctUsed} />
          <div className="flex items-center justify-between mt-1">
            <span style={{ fontSize: 11, color: pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#475569" }}>
              {pctUsed.toFixed(0)}% used
            </span>
          </div>

          {/* Danger zone warning */}
          {isActive && pctUsed > 80 && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <p style={{ fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>
                Approaching max drawdown.{" "}
                <strong>{formatCurrency(fromBlown)}</strong> from blown account.
              </p>
            </div>
          )}
        </div>
      </Card>
      )}

      {/* ── Section 3: Quick Stats ────────────────────────────────── */}
      <div>
        <SectionTitle>Quick Stats</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatMiniCard
            label="Trade Count"
            value={tradeCount}
            sub="total trades"
          />
          <StatMiniCard
            label="Win Rate"
            value={
              <span style={{ color: winRate >= 40 ? "var(--positive)" : winRate >= 30 ? "var(--warning)" : "var(--negative)" }}>
                {tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}
              </span>
            }
            sub="wins / (wins + losses)"
          />
          <StatMiniCard
            label="Avg P&L / Trade"
            value={
              <span style={{ color: avgPnl > 0 ? "var(--positive)" : avgPnl < 0 ? "var(--negative)" : "#94A3B8" }}>
                {tradeCount > 0 ? formatCurrency(avgPnl) : "—"}
              </span>
            }
          />
          <StatMiniCard
            label="Best / Worst Pair"
            value={
              <span style={{ fontSize: 13 }}>
                <span style={{ color: "var(--positive)" }}>{bestPair}</span>
                {worstPair !== "—" && (
                  <>
                    <span style={{ color: "#475569" }}> / </span>
                    <span style={{ color: "var(--negative)" }}>{worstPair}</span>
                  </>
                )}
              </span>
            }
          />
        </div>
      </div>

      {/* ── Section 4: Recent Trades ──────────────────────────────── */}
      <div>
        <SectionTitle>Recent Trades</SectionTitle>
        {recentTrades.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748B" }}>No closed trades on this account.</p>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(148,163,184,0.08)" }}
          >
            {recentTrades.map((trade, i) => {
              const pnlCol = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";
              return (
                <button
                  key={trade.id}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
                  style={{
                    background: i % 2 === 0 ? "rgba(20,28,40,0.7)" : "rgba(15,23,35,0.5)",
                    borderBottom: i < recentTrades.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "rgba(20,28,40,0.7)" : "rgba(15,23,35,0.5)")}
                  onClick={() => onTradeClick?.(trade.id)}
                >
                  <span style={{ fontSize: 11, color: "#64748B", minWidth: 52 }}>
                    {new Date(trade.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontSize: 12, color: "#E2E8F0", flex: 1 }}>
                    {getPairDisplay(trade.pair)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pnlCol, minWidth: 64, textAlign: "right" }}>
                    {trade.blended_pnl > 0 ? "+" : ""}{formatCurrency(trade.blended_pnl)}
                  </span>
                  <ExitTypePill type={trade.exit_type} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Payouts (prop) / Deposits & Withdrawals (personal) ── */}
      {prop ? (
        <div>
          <SectionTitle>Payouts</SectionTitle>
          {account.payouts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748B" }}>No payouts logged yet.</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(148,163,184,0.08)" }}
            >
              {account.payouts.map((payout: Payout, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{
                    background: i % 2 === 0 ? "rgba(20,28,40,0.7)" : "rgba(15,23,35,0.5)",
                    borderBottom: i < account.payouts.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#64748B", minWidth: 80 }}>
                    {new Date(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--positive)", flex: 1 }}>
                    +{formatCurrency(payout.amount)}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748B" }}>
                    Running: {formatCurrency(payout.running_total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <SectionTitle>Deposits &amp; Withdrawals</SectionTitle>
          {account.cash_flows.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748B" }}>No deposits or withdrawals logged yet.</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(148,163,184,0.08)" }}
            >
              {account.cash_flows.map((cf, i) => {
                const isOut = cf.type === "withdrawal";
                const color = isOut ? "var(--negative)" : "var(--positive)";
                const cfLabel = cf.type === "deposit" ? "Deposit" : cf.type === "withdrawal" ? "Withdrawal" : "Payout";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{
                      background: i % 2 === 0 ? "rgba(20,28,40,0.7)" : "rgba(15,23,35,0.5)",
                      borderBottom: i < account.cash_flows.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#64748B", minWidth: 80 }}>
                      {new Date(cf.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 12, color: "#94A3B8", flex: 1 }}>
                      {cfLabel}
                      {cf.note ? <span style={{ color: "#64748B" }}> · {cf.note}</span> : null}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>
                      {isOut ? "−" : "+"}
                      {formatCurrency(cf.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
