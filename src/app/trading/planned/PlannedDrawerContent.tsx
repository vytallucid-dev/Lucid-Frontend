"use client";

import { type PlannedTrade, pairs, getDistanceToEntry } from "@/lib/demo-data";

// ── Helpers shared with table ─────────────────────────────────────────────────
export function calcRR(t: PlannedTrade): number {
  const entry = t.planned_entry;
  const sl = t.planned_sl;
  const tp = t.planned_main_tp;
  const reward = Math.abs(tp - entry);
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return reward / risk;
}

export function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Breakout:    { bg: "rgba(168,85,247,0.12)",  color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    Short:       { bg: "rgba(148,163,184,0.1)",  color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {model}
    </span>
  );
}

export function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High")
    return (
      <span className="pill" style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.25)" }}>
        High
      </span>
    );
  if (conviction === "Medium")
    return (
      <span className="pill" style={{ background: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.2)" }}>
        Medium
      </span>
    );
  return (
    <span className="pill" style={{ background: "rgba(100,116,139,0.1)", color: "#64748B", border: "1px solid rgba(100,116,139,0.15)" }}>
      Low
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    Ready:       { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "rgba(245,158,11,0.3)" },
    Watching:    { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Invalidated: { bg: "rgba(100,116,139,0.1)", color: "#64748B", border: "rgba(100,116,139,0.15)" },
    Cancelled:   { bg: "rgba(71,85,105,0.1)",   color: "#475569", border: "rgba(71,85,105,0.15)" },
  };
  const s = map[status] ?? map["Cancelled"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Distance badge ────────────────────────────────────────────────────────────
export function DistanceBadge({ trade, large }: { trade: PlannedTrade; large?: boolean }) {
  const dist = getDistanceToEntry(trade);

  if (dist.direction === "at") {
    return (
      <span className="flex items-center gap-1.5" style={{ color: "#10B981", fontWeight: 700, fontSize: large ? 22 : 13 }}>
        <span
          className="pulse-live"
          style={{
            display: "inline-block",
            width: large ? 10 : 7,
            height: large ? 10 : 7,
            borderRadius: "50%",
            background: "#10B981",
            flexShrink: 0,
          }}
        />
        at entry
      </span>
    );
  }

  const within10 = dist.pips <= 10;
  const within50 = dist.pips <= 50;

  let color = "#64748B";
  if (within10) color = "#F59E0B";
  else if (within50) color = "#E2E8F0";

  const arrow = dist.direction === "above" ? "↑" : "↓";

  return (
    <span style={{ color, fontWeight: within10 ? 600 : 400, fontSize: large ? 22 : 13 }}>
      {arrow} {dist.pips} pips {dist.direction}
    </span>
  );
}

// ── Setup ladder (planned version) ────────────────────────────────────────────
function PlannedLadder({ trade }: { trade: PlannedTrade }) {
  const isSell = trade.direction === "Sell";

  interface LevelItem {
    label: string;
    price: number;
    type: "sl" | "entry" | "tp1" | "tp_main";
  }

  const levels: LevelItem[] = [];
  if (isSell) {
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl" });
    levels.push({ label: "Entry", price: trade.planned_entry, type: "entry" });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1" });
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main" });
  } else {
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main" });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1" });
    levels.push({ label: "Entry", price: trade.planned_entry, type: "entry" });
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl" });
  }

  function dotColor(item: LevelItem) {
    if (item.type === "entry") return "#3B82F6";
    if (item.type === "sl") return "#475569";
    return "#475569";
  }

  function labelColor(item: LevelItem) {
    if (item.type === "entry") return "#93C5FD";
    if (item.type === "sl") return "#64748B";
    if (item.type === "tp_main") return "#10B981";
    return "#94A3B8";
  }

  return (
    <div className="flex flex-col gap-0 my-1">
      {levels.map((lvl, i) => (
        <div key={i} className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: labelColor(lvl), width: 60, textAlign: "right", flexShrink: 0 }}>
            {lvl.label}
          </span>
          <div className="flex flex-col items-center" style={{ width: 16 }}>
            {i > 0 && <div style={{ width: 2, height: 14, background: "rgba(148,163,184,0.15)" }} />}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: dotColor(lvl),
                border: lvl.type === "entry" ? "none" : "1px solid rgba(148,163,184,0.2)",
                flexShrink: 0,
              }}
            />
            {i < levels.length - 1 && <div style={{ width: 2, height: 14, background: "rgba(148,163,184,0.15)" }} />}
          </div>
          <span style={{ fontSize: 12, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>
            {lvl.price}
          </span>
        </div>
      ))}
    </div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B", letterSpacing: "0.08em" }}>
      {children}
    </p>
  );
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#E2E8F0" }}>{value}</span>
    </div>
  );
}

// ── Main drawer component ─────────────────────────────────────────────────────
export function PlannedDrawerContent({
  trade,
  onConvert,
  onMarkInvalidated,
}: {
  trade: PlannedTrade;
  onConvert: (t: PlannedTrade) => void;
  onMarkInvalidated: (t: PlannedTrade) => void;
}) {
  const config = pairs.find(p => p.symbol === trade.pair);
  const rr = calcRR(trade);
  const dist = getDistanceToEntry(trade);
  const canConvert = trade.status === "Watching" || trade.status === "Ready";
  const isNearTrigger = trade.status === "Ready" && dist.pips <= 10;

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Header block */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {config && (
              <span style={{ fontSize: 18, lineHeight: 1 }}>
                {config.flag_a}{config.flag_b}
              </span>
            )}
            <span className="text-lg font-bold" style={{ color: "#E2E8F0" }}>
              {config?.display_name ?? trade.pair}
            </span>
            <ModelPill model={trade.model} />
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: trade.direction === "Buy" ? "#10B981" : "#EF4444",
              }}
            >
              {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
            </span>
            <StatusPill status={trade.status} />
          </div>
        </div>
        <ConvictionPill conviction={trade.conviction} />
      </div>

      {/* Setup card */}
      <Card>
        <SectionTitle>Setup Levels</SectionTitle>
        <PlannedLadder trade={trade} />
        <div style={{ height: 1, background: "rgba(148,163,184,0.06)", margin: "12px 0" }} />
        {kv("R:R Plan", <span style={{ color: rr >= 2 ? "#10B981" : "#E2E8F0", fontWeight: 600 }}>{rr.toFixed(2)}R</span>)}
        {kv("Planned Risk", `${trade.planned_risk_pct}%`)}
      </Card>

      {/* Distance card */}
      <Card>
        <SectionTitle>Distance to Entry</SectionTitle>
        <div className="flex flex-col gap-1 mb-3">
          <DistanceBadge trade={trade} large />
          <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Current: {trade.current_market_price} · Planned: {trade.planned_entry}
          </p>
        </div>
        {isNearTrigger && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <span style={{ fontSize: 14 }}>⚠</span>
            <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 500 }}>
              Setup approaching trigger zone.
            </span>
          </div>
        )}
      </Card>

      {/* Notes */}
      {trade.notes && (
        <Card>
          <SectionTitle>Notes</SectionTitle>
          <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.notes}</p>
        </Card>
      )}

      {/* Added date */}
      <p style={{ fontSize: 11, color: "#475569" }}>
        Added {new Date(trade.date_added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </p>

      {/* Sticky bottom action bar */}
      <div
        className="fixed bottom-0 right-0 flex items-center gap-3 px-4 sm:px-6 py-4 w-full sm:w-auto"
        style={{
          maxWidth: 480,
          background: "rgba(10,18,30,0.97)",
          borderTop: "1px solid rgba(148,163,184,0.1)",
          backdropFilter: "blur(12px)",
          zIndex: 10,
        }}
      >
        {canConvert && (
          <button
            onClick={() => onConvert(trade)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "rgba(59,130,246,0.9)", color: "#fff" }}
          >
            Convert to Live Trade
          </button>
        )}
        {trade.status !== "Invalidated" && trade.status !== "Cancelled" && (
          <button
            onClick={() => onMarkInvalidated(trade)}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "#64748B", border: "1px solid rgba(148,163,184,0.12)" }}
          >
            Mark Invalidated
          </button>
        )}
      </div>
    </div>
  );
}
