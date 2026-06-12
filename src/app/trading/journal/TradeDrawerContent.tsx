"use client";

import { Pencil, Trash2 } from "lucide-react";
import { type Trade, pairs, formatCurrency, formatDate, formatTime } from "@/lib/demo-data";
import { ScreenshotGallery } from "@/components/ScreenshotUploader";

// ── Reusable pill/helpers ─────────────────────────────────────────────────────
function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Breakout:    { bg: "rgba(168,85,247,0.12)",  color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    Short:       { bg: "rgba(148,163,184,0.1)",  color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{model}</span>;
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#E2E8F0" }}>{value}</span>
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

// ── Execution ladder ──────────────────────────────────────────────────────────
function ExecutionLadder({ trade }: { trade: Trade }) {
  const isLive = !trade.date_closed;
  const isSell = trade.direction === "Sell";

  interface LevelItem {
    label: string;
    price: number;
    type: "sl" | "entry" | "tp1" | "tp_main";
    hit: boolean;
  }

  const levels: LevelItem[] = [];

  // For Sell: higher prices at top; for Buy: lower prices at bottom
  if (isSell) {
    levels.push({ label: "SL", price: trade.sl_price, type: "sl", hit: !isLive && trade.exit_type === "SL" });
    levels.push({ label: "Entry", price: trade.entry_price, type: "entry", hit: true });
    if (trade.first_tp_price) levels.push({ label: "First TP", price: trade.first_tp_price, type: "tp1", hit: !isLive && !!trade.partial_exit_price });
    levels.push({ label: "Main TP", price: trade.main_tp_price, type: "tp_main", hit: !isLive && trade.exit_type !== "SL" });
  } else {
    levels.push({ label: "Main TP", price: trade.main_tp_price, type: "tp_main", hit: !isLive && trade.exit_type !== "SL" });
    if (trade.first_tp_price) levels.push({ label: "First TP", price: trade.first_tp_price, type: "tp1", hit: !isLive && !!trade.partial_exit_price });
    levels.push({ label: "Entry", price: trade.entry_price, type: "entry", hit: true });
    levels.push({ label: "SL", price: trade.sl_price, type: "sl", hit: !isLive && trade.exit_type === "SL" });
  }

  function dotColor(item: LevelItem) {
    if (item.type === "entry") return "#3B82F6";
    if (item.type === "sl") return item.hit ? "var(--negative)" : "#475569";
    return item.hit ? "var(--positive)" : "#475569";
  }

  function labelColor(item: LevelItem) {
    if (item.type === "entry") return "#93C5FD";
    if (item.type === "sl") return item.hit ? "var(--negative)" : "#64748B";
    return item.hit ? "var(--positive)" : "#64748B";
  }

  return (
    <div className="flex flex-col gap-0 my-1">
      {levels.map((lvl, i) => (
        <div key={i} className="flex items-center gap-3">
          {/* Label */}
          <span style={{ fontSize: 11, color: labelColor(lvl), width: 60, textAlign: "right", flexShrink: 0 }}>
            {lvl.label}
          </span>
          {/* Connector + dot */}
          <div className="flex flex-col items-center" style={{ width: 16 }}>
            {i > 0 && <div style={{ width: 2, height: 14, background: "rgba(148,163,184,0.15)" }} />}
            <div
              style={{
                width: lvl.hit ? 10 : 8,
                height: lvl.hit ? 10 : 8,
                borderRadius: "50%",
                background: dotColor(lvl),
                border: lvl.hit ? "none" : "1px solid rgba(148,163,184,0.2)",
                flexShrink: 0,
              }}
            />
            {i < levels.length - 1 && <div style={{ width: 2, height: 14, background: "rgba(148,163,184,0.15)" }} />}
          </div>
          {/* Price */}
          <span style={{ fontSize: 12, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>
            {lvl.price}
          </span>
          {/* Partial note */}
          {lvl.type === "tp1" && trade.partial_exit_price && (
            <span style={{ fontSize: 11, color: "#64748B", marginLeft: 4 }}>
              ({trade.partial_exit_lot_pct}% partial)
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Held duration ─────────────────────────────────────────────────────────────
function heldDuration(opened: string, closed: string): string {
  const start = new Date(opened).getTime();
  const end = closed ? new Date(closed).getTime() : Date.now();
  const ms = end - start;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

// ── Main component ────────────────────────────────────────────────────────────
export function TradeDrawerContent({
  trade,
  onEdit,
  onDelete,
}: {
  trade: Trade;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isLive = !trade.date_closed;
  const config = pairs.find(p => p.symbol === trade.pair);
  const pnlColor = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";
  const rrColor = trade.blended_rr > 0 ? "var(--positive)" : trade.blended_rr < 0 ? "var(--negative)" : "#94A3B8";
  const pipsColor = trade.total_pips > 0 ? "var(--positive)" : trade.total_pips < 0 ? "var(--negative)" : "#94A3B8";

  return (
    <div className="flex flex-col gap-5">

      {/* Edit / Delete actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-end gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: "#94A3B8", border: "1px solid rgba(148,163,184,0.15)" }}
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}

      {/* Section 1: Outcome */}
      <Card>
        <div className="flex items-start justify-between">
          {/* P&L */}
          <div>
            {isLive ? (
              <div className="flex items-center gap-2">
                <span className="pulse-live w-2 h-2 rounded-full" style={{ background: "#3B82F6", display: "inline-block" }} />
                <span style={{ fontSize: 28, fontWeight: 700, color: "#93C5FD" }}>Live</span>
              </div>
            ) : (
              <span style={{ fontSize: 28, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(trade.blended_pnl)}
              </span>
            )}
          </div>

          {/* Pips + R:R + pills */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="pill pill-blue" style={{ color: isLive ? "#64748B" : undefined, background: isLive ? "rgba(148,163,184,0.08)" : undefined }}>
                {isLive ? "— pips" : `${trade.total_pips > 0 ? "+" : ""}${trade.total_pips} pips`}
              </span>
              <span
                className="pill"
                style={{
                  background: "rgba(148,163,184,0.08)",
                  color: isLive ? "#64748B" : rrColor,
                  border: "1px solid rgba(148,163,184,0.15)",
                }}
              >
                {isLive ? "—" : `${trade.blended_rr}R`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="pill"
                style={{
                  background: trade.exit_type === "TP" || trade.exit_type === "Partial+TP" ? "var(--positive-bg)"
                    : trade.exit_type === "SL" || trade.exit_type === "Partial+SL" ? "var(--negative-bg)"
                    : trade.exit_type === "Manual" ? "var(--warning-bg)" : "rgba(148,163,184,0.1)",
                  color: trade.exit_type === "TP" || trade.exit_type === "Partial+TP" ? "var(--positive)"
                    : trade.exit_type === "SL" || trade.exit_type === "Partial+SL" ? "var(--negative)"
                    : trade.exit_type === "Manual" ? "var(--warning)" : "#94A3B8",
                  border: "1px solid rgba(148,163,184,0.1)",
                }}
              >
                {trade.exit_type}
              </span>
              <span
                className="pill"
                style={{
                  background: trade.conviction === "High" ? "var(--accent-blue-glow)" : "rgba(148,163,184,0.1)",
                  color: trade.conviction === "High" ? "var(--accent-blue)" : "#94A3B8",
                  border: `1px solid ${trade.conviction === "High" ? "rgba(59,130,246,0.25)" : "rgba(148,163,184,0.2)"}`,
                }}
              >
                {trade.conviction} Conviction
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2: Setup */}
      <div>
        <SectionTitle>Setup</SectionTitle>
        <Card>
          <div>
            {kv("Pair",
              <span className="flex items-center gap-1">
                {config && <span>{config.flag_a}{config.flag_b}</span>}
                <span>{config?.display_name ?? trade.pair}</span>
              </span>
            )}
            {kv("Model", <ModelPill model={trade.model} />)}
            {kv("Direction",
              <span style={{ color: trade.direction === "Buy" ? "var(--positive)" : "var(--negative)", fontWeight: 600 }}>
                {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
              </span>
            )}
            {kv("Session", trade.session)}
            {kv("Risk", `${trade.risk_pct}% ($${(trade.risk_pct / 100 * 10000).toFixed(0)} approx.)`)}
          </div>
        </Card>
      </div>

      {/* Section 3: Execution */}
      <div>
        <SectionTitle>Execution</SectionTitle>
        <Card>
          <ExecutionLadder trade={trade} />
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}>
            {kv("Opened", `${formatDate(trade.date_opened)} · ${formatTime(trade.date_opened)}`)}
            {isLive
              ? kv("Closed", <span style={{ color: "#93C5FD" }}>Running</span>)
              : kv("Closed", `${formatDate(trade.date_closed)} · ${formatTime(trade.date_closed)}`)}
            {kv("Held", heldDuration(trade.date_opened, trade.date_closed))}
          </div>
        </Card>
      </div>

      {/* Section 4: Context */}
      <div>
        <SectionTitle>Context</SectionTitle>
        <Card>
          {kv("Lucid Score",
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>
                {trade.fundamental_score ?? "—"}
              </span>
            </span>
          )}
          {kv("Psychology",
            <span
              className="pill"
              style={{ background: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.2)" }}
            >
              {trade.psychology}
            </span>
          )}
          <div className="pt-2">
            <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
            <p style={{ fontSize: 13, color: trade.notes ? "#94A3B8" : "#334155", fontStyle: trade.notes ? "normal" : "italic", lineHeight: 1.6 }}>
              {trade.notes || "No notes for this trade."}
            </p>
          </div>
        </Card>
      </div>

      {/* Section 5: Screenshots */}
      <div>
        <SectionTitle>Screenshots</SectionTitle>
        <Card>
          <ScreenshotGallery urls={trade.screenshots} tileHeight={150} />
        </Card>
      </div>

      {/* Section 6: Memory */}
      <div>
        <SectionTitle>Memory</SectionTitle>
        <div className="flex flex-col gap-3">

          {/* Card A — Pre-Trade Discussion */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>Pre-Trade Discussion</p>
              {!trade.pre_trade_memory && (
                <span
                  className="pill"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.2)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.pre_trade_memory ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Setup</p>
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.pre_trade_memory.setup_description}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fundamental Bias at Entry</p>
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.pre_trade_memory.fundamental_bias_at_entry}</p>
                </div>
                {trade.pre_trade_memory.agreements.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Agreements</p>
                    <ul className="flex flex-col gap-1">
                      {trade.pre_trade_memory.agreements.map((a, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: "var(--positive)", lineHeight: 1.5 }}>
                          <span style={{ marginTop: 2, flexShrink: 0 }}>●</span>
                          <span style={{ color: "#94A3B8" }}>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trade.pre_trade_memory.disagreements.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Disagreements</p>
                    <ul className="flex flex-col gap-1">
                      {trade.pre_trade_memory.disagreements.map((d, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: "var(--warning)", lineHeight: 1.5 }}>
                          <span style={{ marginTop: 2, flexShrink: 0 }}>●</span>
                          <span style={{ color: "#94A3B8" }}>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#334155", fontStyle: "italic", lineHeight: 1.6 }}>
                Lucid will save your pre-trade discussion here in Phase 3. You&apos;ll see your setup reasoning, fundamental bias at entry, and any disagreements with Lucid&apos;s analysis.
              </p>
            )}
          </Card>

          {/* Card B — Decision Reasoning */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>Decision Reasoning</p>
              {!trade.pre_trade_memory && (
                <span
                  className="pill"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.2)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.pre_trade_memory?.decision_reasoning ? (
              <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
                {trade.pre_trade_memory.decision_reasoning}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#334155", fontStyle: "italic", lineHeight: 1.6 }}>
                Your decision reasoning will be saved here — why you took this trade, what the key variables were, and how confident you felt in the moment.
              </p>
            )}
          </Card>

          {/* Card C — Debrief */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>Debrief</p>
              {!trade.debrief_memory && (
                <span
                  className="pill"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.2)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.debrief_memory ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome Summary</p>
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.debrief_memory.outcome_summary}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expectation vs Reality</p>
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.debrief_memory.expectation_vs_reality}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Decision Quality</p>
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{trade.debrief_memory.decision_quality_note}</p>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#334155", fontStyle: "italic", lineHeight: 1.6 }}>
                  Debrief notes will appear here after the trade closes. What happened vs. what you expected, and what you&apos;d do differently.
                </p>
                <button
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: "rgba(148,163,184,0.08)",
                    border: "1px solid rgba(148,163,184,0.15)",
                    color: "#94A3B8",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.12)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)"; }}
                >
                  Add Debrief Note
                </button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
