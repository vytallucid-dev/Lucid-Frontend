"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  trades as allTrades,
  accounts,
  formatCurrency,
  type Trade,
  type Conviction,
} from "@/lib/demo-data";

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRangePreset =
  | "Last 7 days"
  | "Last 30 days"
  | "Last 90 days"
  | "Year to Date"
  | "All Time"
  | "Custom...";

type AnalyticsTab = "Performance" | "Fundamentals" | "Simulated vs Live";

// ─── Filter ───────────────────────────────────────────────────────────────────

function applyDateFilter(tradeList: Trade[], preset: DateRangePreset): Trade[] {
  if (preset === "All Time" || preset === "Custom...") return tradeList;
  const now = new Date();
  let cutoff: Date;
  switch (preset) {
    case "Last 7 days":
      cutoff = new Date(now.getTime() - 7 * 864e5);
      break;
    case "Last 30 days":
      cutoff = new Date(now.getTime() - 30 * 864e5);
      break;
    case "Last 90 days":
      cutoff = new Date(now.getTime() - 90 * 864e5);
      break;
    case "Year to Date":
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return tradeList;
  }
  return tradeList.filter((t) => {
    const date = t.date_closed ? new Date(t.date_closed) : new Date(t.date_opened);
    return date >= cutoff;
  });
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function computeStats(filtered: Trade[]) {
  const closed = filtered.filter((t) => t.date_closed !== "");
  const wins = closed.filter((t) => t.blended_rr > 0);
  const losses = closed.filter((t) => t.blended_rr < 0);

  const winRate = wins.length + losses.length > 0 ? wins.length / (wins.length + losses.length) : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.blended_pnl, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((s, t) => s + t.blended_pnl, 0) / losses.length)
      : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  const winsClosed = closed.filter((t) => t.blended_rr > 0);
  const avgRR =
    winsClosed.length > 0
      ? winsClosed.reduce((s, t) => s + t.blended_rr, 0) / winsClosed.length
      : 0;

  const netPnl = closed.reduce((s, t) => s + t.blended_pnl, 0);
  const totalTrades = filtered.length;
  const avgRisk =
    closed.length > 0 ? closed.reduce((s, t) => s + t.risk_pct, 0) / closed.length : 0;

  return { winRate, expectancy, avgRR, netPnl, totalTrades, avgRisk, wins, losses, closed };
}

// ─── P&L Curve ───────────────────────────────────────────────────────────────

interface CurvePoint {
  date: string;
  cumPnl: number;
  pair: string;
  pnl: number;
}

function buildPnlCurve(filtered: Trade[]): CurvePoint[] {
  const closed = [...filtered.filter((t) => t.date_closed !== "")].sort(
    (a, b) => new Date(a.date_closed).getTime() - new Date(b.date_closed).getTime()
  );
  const running = filtered.find((t) => t.date_closed === "");

  const points: CurvePoint[] = [];
  let cum = 0;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  for (const t of closed) {
    cum += t.blended_pnl;
    points.push({ date: fmt(t.date_closed), cumPnl: Math.round(cum * 100) / 100, pair: t.pair, pnl: t.blended_pnl });
  }

  if (running) {
    points.push({
      date: fmt(running.date_opened) + " ·Live",
      cumPnl: Math.round(cum * 100) / 100,
      pair: running.pair,
      pnl: 0,
    });
  }

  return points;
}

function computeDrawdownWindows(pts: CurvePoint[]): { x1: string; x2: string }[] {
  const windows: { x1: string; x2: string }[] = [];
  let peak = -Infinity;
  let inDD = false;
  let ddStartIdx = 0;

  for (let i = 0; i < pts.length; i++) {
    const v = pts[i].cumPnl;
    if (v > peak) {
      if (inDD) {
        windows.push({ x1: pts[ddStartIdx].date, x2: pts[i - 1].date });
        inDD = false;
      }
      peak = v;
    } else if (v < peak && !inDD) {
      inDD = true;
      ddStartIdx = i - 1 >= 0 ? i - 1 : 0;
    }
  }
  if (inDD && pts.length > 0) {
    windows.push({ x1: pts[ddStartIdx].date, x2: pts[pts.length - 1].date });
  }
  return windows;
}

function computeMaxDrawdown(pts: CurvePoint[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const p of pts) {
    if (p.cumPnl > peak) peak = p.cumPnl;
    const dd = peak - p.cumPnl;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ─── Breakdowns ───────────────────────────────────────────────────────────────

function groupByPnl<K extends string>(closed: Trade[], key: (t: Trade) => K) {
  const map = new Map<K, number>();
  for (const t of closed) {
    const k = key(t);
    map.set(k, (map.get(k) ?? 0) + t.blended_pnl);
  }
  return Array.from(map.entries())
    .map(([k, pnl]) => ({ key: k, pnl }))
    .sort((a, b) => b.pnl - a.pnl);
}

function computeByConviction(filtered: Trade[]) {
  const levels: Conviction[] = ["High", "Medium", "Low"];
  return levels.map((conv) => {
    const ct = filtered.filter((t) => t.conviction === conv && t.date_closed !== "");
    const w = ct.filter((t) => t.blended_rr > 0);
    const l = ct.filter((t) => t.blended_rr < 0);
    const wr = w.length + l.length > 0 ? w.length / (w.length + l.length) : 0;
    const netPnl = ct.reduce((s, t) => s + t.blended_pnl, 0);
    return { conviction: conv, count: ct.length, wr, netPnl };
  });
}

// ─── Streaks ──────────────────────────────────────────────────────────────────

function computeStreaks(closed: Trade[]) {
  const sorted = [...closed].sort(
    (a, b) => new Date(a.date_closed).getTime() - new Date(b.date_closed).getTime()
  );

  let longestWin = 0;
  let longestLoss = 0;
  let tempWin = 0;
  let tempLoss = 0;

  for (const t of sorted) {
    if (t.blended_rr > 0) {
      tempWin++;
      tempLoss = 0;
      if (tempWin > longestWin) longestWin = tempWin;
    } else if (t.blended_rr < 0) {
      tempLoss++;
      tempWin = 0;
      if (tempLoss > longestLoss) longestLoss = tempLoss;
    } else {
      tempWin = 0;
      tempLoss = 0;
    }
  }

  // Current streak (end of sorted list)
  let currentStreak = 0;
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1];
    const isWin = last.blended_rr > 0;
    const isLoss = last.blended_rr < 0;
    if (isWin || isLoss) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (isWin && sorted[i].blended_rr > 0) currentStreak++;
        else if (isLoss && sorted[i].blended_rr < 0) currentStreak--;
        else break;
      }
    }
  }

  // Best day of week
  const dayPnl = new Map<number, number>();
  for (const t of sorted) {
    const day = new Date(t.date_closed).getDay();
    dayPnl.set(day, (dayPnl.get(day) ?? 0) + t.blended_pnl);
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let bestDay = "—";
  let bestDayPnl = -Infinity;
  for (const [day, pnl] of dayPnl) {
    if (pnl > bestDayPnl) {
      bestDayPnl = pnl;
      bestDay = dayNames[day];
    }
  }

  return { currentStreak, longestWin, longestLoss, bestDay, sorted };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col gap-1.5"
      style={{
        background: "rgba(20,28,40,0.6)",
        border: "1px solid rgba(148,163,184,0.1)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "#64748B",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, color: color ?? "#E2E8F0" }}>{value}</span>
    </div>
  );
}

function HBar({
  label,
  pnl,
  maxAbs,
}: {
  label: string;
  pnl: number;
  maxAbs: number;
}) {
  const pos = pnl >= 0;
  const pct = maxAbs > 0 ? (Math.abs(pnl) / maxAbs) * 100 : 0;
  const barColor = pos ? "#10B981" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, color: "#94A3B8", width: 100, flexShrink: 0, textAlign: "right" }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 7,
          background: "rgba(148,163,184,0.1)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: barColor, width: 72, flexShrink: 0 }}>
        {pos ? "+" : ""}
        {formatCurrency(pnl)}
      </span>
    </div>
  );
}

function PnlTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurvePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(10,14,20,0.95)",
        border: "1px solid rgba(148,163,184,0.2)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{d.date}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{formatCurrency(d.cumPnl)}</p>
      {d.pair && (
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
          {d.pair} · {d.pnl >= 0 ? "+" : ""}
          {formatCurrency(d.pnl)}
        </p>
      )}
    </div>
  );
}

function RiskHistogram({ filtered }: { filtered: Trade[] }) {
  const closed = filtered.filter((t) => t.date_closed !== "");
  const buckets = [
    { label: "<0.5%", count: closed.filter((t) => t.risk_pct < 0.5).length },
    { label: "0.5–1%", count: closed.filter((t) => t.risk_pct >= 0.5 && t.risk_pct < 1).length },
    { label: "1–1.5%", count: closed.filter((t) => t.risk_pct >= 1 && t.risk_pct < 1.5).length },
    { label: "1.5%+", count: closed.filter((t) => t.risk_pct >= 1.5).length },
  ];
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: 44 }}>
      {buckets.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
          <div
            style={{
              width: "100%",
              height: `${(b.count / maxCount) * 32}px`,
              background: "#3B82F6",
              borderRadius: "2px 2px 0 0",
              opacity: 0.75,
            }}
          />
          <span style={{ fontSize: 9, color: "#64748B", textAlign: "center" }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function TradeCalendar({ filtered }: { filtered: Trade[] }) {
  const closed = [...filtered.filter((t) => t.date_closed !== "")]
    .sort((a, b) => new Date(a.date_closed).getTime() - new Date(b.date_closed).getTime())
    .slice(-30);

  const boxes: { outcome: "win" | "loss" | "be" | "empty"; trade?: Trade }[] = [];
  for (let i = 0; i < 30 - closed.length; i++) boxes.push({ outcome: "empty" });
  for (const t of closed) {
    const outcome = t.blended_rr > 0 ? "win" : t.blended_rr < 0 ? "loss" : "be";
    boxes.push({ outcome, trade: t });
  }

  const colors = {
    win: "#10B981",
    loss: "#EF4444",
    be: "#475569",
    empty: "rgba(148,163,184,0.08)",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
      {boxes.map((box, i) => (
        <div
          key={i}
          title={
            box.trade
              ? `${box.trade.pair} · ${box.trade.blended_pnl >= 0 ? "+" : ""}${formatCurrency(box.trade.blended_pnl)}`
              : ""
          }
          style={{
            height: 22,
            borderRadius: 4,
            background: colors[box.outcome],
            opacity: box.outcome === "empty" ? 0.4 : 1,
            cursor: box.trade ? "default" : "default",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>("Performance");
  const [dateRange, setDateRange] = useState<DateRangePreset>("All Time");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let t = allTrades;
    if (accountFilter !== "all") t = t.filter((x) => x.account_id === accountFilter);
    return applyDateFilter(t, dateRange);
  }, [accountFilter, dateRange]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const curve = useMemo(() => buildPnlCurve(filtered), [filtered]);
  const maxDD = useMemo(() => computeMaxDrawdown(curve), [curve]);
  const ddWindows = useMemo(() => computeDrawdownWindows(curve), [curve]);
  const recoveryFactor = maxDD > 0 ? stats.netPnl / maxDD : 0;

  const byPair = useMemo(() => groupByPnl(stats.closed, (t) => t.pair), [stats.closed]);
  const byModel = useMemo(() => groupByPnl(stats.closed, (t) => t.model), [stats.closed]);
  const bySession = useMemo(() => groupByPnl(stats.closed, (t) => t.session), [stats.closed]);
  const byConviction = useMemo(() => computeByConviction(filtered), [filtered]);
  const streaks = useMemo(() => computeStreaks(stats.closed), [stats.closed]);

  const wrColor =
    stats.winRate > 0.4 ? "#10B981" : stats.winRate < 0.35 ? "#EF4444" : "#F59E0B";

  const maxAbsPair = Math.max(...byPair.map((d) => Math.abs(d.pnl)), 1);
  const maxAbsModel = Math.max(...byModel.map((d) => Math.abs(d.pnl)), 1);
  const maxAbsSession = Math.max(...bySession.map((d) => Math.abs(d.pnl)), 1);
  const maxAbsConvPnl = Math.max(...byConviction.map((c) => Math.abs(c.netPnl)), 1);

  const bestPair = byPair[0]?.key ?? "—";
  const worstPair = byPair[byPair.length - 1]?.key ?? "—";

  const highConv = byConviction.find((c) => c.conviction === "High");
  const lowConv = byConviction.find((c) => c.conviction === "Low");

  const selectStyle: React.CSSProperties = {
    background: "rgba(20,28,40,0.9)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    color: "#E2E8F0",
    fontSize: 13,
    padding: "6px 12px",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 pb-12 flex flex-col gap-0">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>Analytics</h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>Validate the edge.</p>
      </div>

      {/* Universal filter bar */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "10px 0",
          marginBottom: 4,
          background: "rgba(10,14,20,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(148,163,184,0.08)",
        }}
      >
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)} style={selectStyle}>
          {(
            ["Last 7 days", "Last 30 days", "Last 90 days", "Year to Date", "All Time", "Custom..."] as DateRangePreset[]
          ).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_name}
            </option>
          ))}
        </select>
      </div>

      {/* Sub-tab nav */}
      <div
        className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 24,
          paddingTop: 12,
        }}
      >
        {(["Performance", "Fundamentals", "Simulated vs Live"] as AnalyticsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "#E2E8F0" : "#64748B",
              paddingBottom: 10,
              marginBottom: -1,
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "#3B82F6" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Performance ────────────────────────────────────────────────── */}
      {tab === "Performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* A — Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <OverviewCard
              label="Win Rate"
              value={`${(stats.winRate * 100).toFixed(1)}%`}
              color={wrColor}
            />
            <OverviewCard
              label="Expectancy"
              value={(stats.expectancy >= 0 ? "+" : "") + formatCurrency(stats.expectancy)}
              color={stats.expectancy >= 0 ? "#10B981" : "#EF4444"}
            />
            <OverviewCard label="Avg R:R" value={`${stats.avgRR.toFixed(2)}R`} />
            <OverviewCard
              label="Net P&L"
              value={(stats.netPnl >= 0 ? "+" : "") + formatCurrency(stats.netPnl)}
              color={stats.netPnl >= 0 ? "#10B981" : "#EF4444"}
            />
            <OverviewCard label="Total Trades" value={String(stats.totalTrades)} />
          </div>

          {/* B — P&L Curve */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "rgba(20,28,40,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>
                Cumulative P&L
              </h3>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.12)",
                    color: "#EF4444",
                    border: "1px solid rgba(239,68,68,0.2)",
                    fontWeight: 600,
                  }}
                >
                  Max DD: −{formatCurrency(maxDD)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "rgba(59,130,246,0.12)",
                    color: "#3B82F6",
                    border: "1px solid rgba(59,130,246,0.2)",
                    fontWeight: 600,
                  }}
                >
                  Recovery: {recoveryFactor > 0 ? recoveryFactor.toFixed(2) : "—"}
                </span>
              </div>
            </div>

            {curve.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={58}
                  />
                  <Tooltip content={<PnlTooltip />} />
                  <ReferenceLine
                    y={0}
                    stroke="rgba(148,163,184,0.3)"
                    strokeDasharray="4 4"
                  />
                  {ddWindows.map((w, i) => (
                    <ReferenceArea
                      key={i}
                      x1={w.x1}
                      x2={w.x2}
                      fill="rgba(239,68,68,0.08)"
                      ifOverflow="visible"
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="cumPnl"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#pnlGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ height: 320, color: "#64748B", fontSize: 13 }}
              >
                No closed trades for this period.
              </div>
            )}
          </div>

          {/* C — Breakdown Grid 2×2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: By Pair */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(20,28,40,0.6)",
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 14,
                }}
              >
                By Pair
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {byPair.length > 0 ? (
                  byPair.map((d) => (
                    <HBar key={d.key} label={d.key} pnl={d.pnl} maxAbs={maxAbsPair} />
                  ))
                ) : (
                  <span style={{ color: "#64748B", fontSize: 12 }}>No data</span>
                )}
              </div>
              {byPair.length > 1 && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(148,163,184,0.08)",
                    fontSize: 11,
                    color: "#64748B",
                  }}
                >
                  Best:{" "}
                  <span style={{ color: "#10B981", fontWeight: 600 }}>{bestPair}</span>
                  {" · "}
                  Worst:{" "}
                  <span style={{ color: "#EF4444", fontWeight: 600 }}>{worstPair}</span>
                </div>
              )}
            </div>

            {/* Card 2: By Model */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(20,28,40,0.6)",
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 14,
                }}
              >
                By Model
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {byModel.length > 0 ? (
                  byModel.map((d) => (
                    <HBar key={d.key} label={d.key} pnl={d.pnl} maxAbs={maxAbsModel} />
                  ))
                ) : (
                  <span style={{ color: "#64748B", fontSize: 12 }}>No data</span>
                )}
              </div>
            </div>

            {/* Card 3: By Session */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(20,28,40,0.6)",
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 14,
                }}
              >
                By Session
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {bySession.length > 0 ? (
                  bySession.map((d) => (
                    <HBar key={d.key} label={d.key} pnl={d.pnl} maxAbs={maxAbsSession} />
                  ))
                ) : (
                  <span style={{ color: "#64748B", fontSize: 12 }}>No data</span>
                )}
              </div>
            </div>

            {/* Card 4: By Conviction — THE edge validation card */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(28,38,54,0.75)",
                border: "1px solid rgba(59,130,246,0.2)",
                boxShadow: "0 0 32px rgba(59,130,246,0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    margin: 0,
                  }}
                >
                  By Conviction
                </h3>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#3B82F6",
                    background: "rgba(59,130,246,0.15)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Edge Validation
                </span>
              </div>

              {/* Column headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 56px 1fr 72px",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 10, color: "#64748B" }}></span>
                <span style={{ fontSize: 10, color: "#64748B" }}>Trades</span>
                <span style={{ fontSize: 10, color: "#64748B" }}>WR · P&L bar</span>
                <span style={{ fontSize: 10, color: "#64748B", textAlign: "right" }}>Net P&L</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {byConviction.map(({ conviction, count, wr, netPnl }) => {
                  const convColor =
                    conviction === "High"
                      ? "#3B82F6"
                      : conviction === "Medium"
                        ? "#94A3B8"
                        : "#64748B";
                  const pnlPct = (Math.abs(netPnl) / maxAbsConvPnl) * 100;
                  const pnlColor =
                    netPnl > 0 ? "#10B981" : netPnl < 0 ? "#EF4444" : "#475569";

                  return (
                    <div key={conviction}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "72px 56px 1fr 72px",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{ fontSize: 13, fontWeight: 700, color: convColor }}
                        >
                          {conviction}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748B" }}>{count}</span>
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>
                          {(wr * 100).toFixed(0)}%
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: pnlColor,
                            textAlign: "right",
                          }}
                        >
                          {netPnl >= 0 ? "+" : ""}
                          {formatCurrency(netPnl)}
                        </span>
                      </div>
                      {/* Split bar: left = WR fill (blue), right = P&L fill (green/red) */}
                      <div style={{ display: "flex", gap: 3, height: 6 }}>
                        <div
                          style={{
                            flex: 1,
                            background: "rgba(148,163,184,0.1)",
                            borderRadius: "3px 0 0 3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${wr * 100}%`,
                              height: "100%",
                              background: "#3B82F6",
                              opacity: 0.85,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            flex: 1,
                            background: "rgba(148,163,184,0.1)",
                            borderRadius: "0 3px 3px 0",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pnlPct}%`,
                              height: "100%",
                              background: pnlColor,
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Callout */}
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 12px",
                  background: "rgba(16,185,129,0.07)",
                  border: "1px solid rgba(16,185,129,0.18)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#94A3B8",
                  lineHeight: 1.6,
                }}
              >
                💡{" "}
                <em>
                  {highConv && lowConv && highConv.wr > lowConv.wr
                    ? `Conviction sizing is working — ${(highConv.wr * 100).toFixed(0)}% WR on High vs ${(lowConv.wr * 100).toFixed(0)}% on Low. Sized correctly, your edge compounds.`
                    : "Build more High-conviction trades to validate your sizing edge."}
                </em>
              </div>
            </div>
          </div>

          {/* D — Risk Analysis */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "rgba(20,28,40,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
            }}
          >
            <h3
              style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", margin: "0 0 20px" }}
            >
              Risk Analysis
            </h3>
            <div
              className="grid grid-cols-2 lg:grid-cols-4"
              style={{
                gap: 24,
                alignItems: "start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Avg Risk / Trade
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#E2E8F0" }}>
                  {stats.avgRisk.toFixed(2)}%
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Risk Distribution
                </div>
                <RiskHistogram filtered={filtered} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Max Drawdown
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#EF4444" }}>
                  −{formatCurrency(maxDD)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Recovery Factor
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: recoveryFactor > 0 ? "#10B981" : "#64748B",
                  }}
                >
                  {recoveryFactor > 0 ? recoveryFactor.toFixed(2) : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                  Net P&L ÷ Max DD
                </div>
              </div>
            </div>
          </div>

          {/* E — Streaks */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "rgba(20,28,40,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
            }}
          >
            <h3
              style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", margin: "0 0 20px" }}
            >
              Streaks
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 32 }}>
              {/* Left: stats */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    Current Streak
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color:
                        streaks.currentStreak > 0
                          ? "#10B981"
                          : streaks.currentStreak < 0
                            ? "#EF4444"
                            : "#64748B",
                    }}
                  >
                    {streaks.currentStreak > 0
                      ? `+${streaks.currentStreak} Wins`
                      : streaks.currentStreak < 0
                        ? `${Math.abs(streaks.currentStreak)} Losses`
                        : "—"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    Longest Win Streak
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>
                    {streaks.longestWin}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    Longest Loss Streak
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>
                    {streaks.longestLoss}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    Best Day of Week
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#E2E8F0" }}>
                    {streaks.bestDay}
                  </div>
                </div>
              </div>

              {/* Right: 30-trade calendar */}
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                  }}
                >
                  Last 30 Trades
                </div>
                <TradeCalendar filtered={filtered} />
                <div className="flex items-center gap-4 mt-3">
                  {(
                    [
                      ["#10B981", "Win"],
                      ["#EF4444", "Loss"],
                      ["#475569", "BE"],
                    ] as [string, string][]
                  ).map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div
                        style={{ width: 10, height: 10, borderRadius: 2, background: color }}
                      />
                      <span style={{ fontSize: 10, color: "#64748B" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Fundamentals ────────────────────────────────────────────────── */}
      {tab === "Fundamentals" && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "60vh" }}
        >
          <div
            className="rounded-xl p-6 sm:p-10 flex flex-col items-center gap-5 w-full mx-4 sm:mx-0"
            style={{
              maxWidth: 600,
              background: "rgba(20,28,40,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#A855F7",
                background: "rgba(168,85,247,0.15)",
                border: "1px solid rgba(168,85,247,0.25)",
                padding: "3px 10px",
                borderRadius: 6,
                textTransform: "uppercase",
              }}
            >
              Phase 2
            </span>
            <div style={{ fontSize: 36 }}>📊</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>
              Fundamentals Analytics
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.8, margin: 0 }}>
              <em>
                Fundamentals analytics will arrive in Phase 2.
                <br />
                Once the Scanner provides fundamental scores, we&apos;ll correlate them with trade
                outcomes — does scoring above threshold actually lead to better outcomes? Does it
                filter out junk setups?
                <br />
                <br />
                Requires 60+ trades with logged fundamental scores.
              </em>
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: Simulated vs Live ───────────────────────────────────────────── */}
      {tab === "Simulated vs Live" && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "60vh" }}
        >
          <div
            className="rounded-xl p-6 sm:p-10 flex flex-col items-center gap-5 w-full mx-4 sm:mx-0"
            style={{
              maxWidth: 600,
              background: "rgba(20,28,40,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#A855F7",
                background: "rgba(168,85,247,0.15)",
                border: "1px solid rgba(168,85,247,0.25)",
                padding: "3px 10px",
                borderRadius: 6,
                textTransform: "uppercase",
              }}
            >
              Phase 2
            </span>
            <div style={{ fontSize: 36 }}>⚙️</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>
              Simulated vs Live
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.8, margin: 0 }}>
              <em>
                Simulated trade comparison will arrive in Phase 2.
                <br />
                Compare missed trades and backtests against your live performance. Are you leaving
                alpha on the table?
              </em>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
