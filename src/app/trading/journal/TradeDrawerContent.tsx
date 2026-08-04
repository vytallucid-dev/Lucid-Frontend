"use client";

import { Pencil, Trash2, Star } from "lucide-react";
import { type Trade, type Execution, pairs, formatCurrency, formatDate, formatTime } from "@/lib/demo-data";
import { getPrimaryExecution, isExecutionOpen } from "@/lib/trade-helpers";
import { ScreenshotGallery } from "@/components/ScreenshotUploader";

// ── Reusable pill/helpers ─────────────────────────────────────────────────────
function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Breakout:    { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
    Short:       { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line)" },
  };
  const s = styles[model] ?? styles["Short"];
  return <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{model}</span>;
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="lx-content-row">
      <span className="lx-content-row-label">{label}</span>
      <span className="lx-content-row-value">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="lx-eyebrow" style={{ marginBottom: 12 }}>{children}</p>;
}

function Section({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="lx-content-section" style={first ? { borderTop: "none", paddingTop: 0 } : undefined}>
      {children}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`lx-card lx-card-compact ${className ?? ""}`}>{children}</div>;
}

// ── Execution ladder — one account's fill against the idea's shared plan ──────
function ExecutionLadder({ trade, execution }: { trade: Trade; execution: Execution }) {
  const isLive = isExecutionOpen(execution);
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
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl", hit: !isLive && execution.exit_type === "SL" });
    levels.push({ label: "Entry", price: execution.entry_price, type: "entry", hit: true });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1", hit: !isLive && !!execution.partial_exit_price });
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main", hit: !isLive && execution.exit_type !== "SL" });
  } else {
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main", hit: !isLive && execution.exit_type !== "SL" });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1", hit: !isLive && !!execution.partial_exit_price });
    levels.push({ label: "Entry", price: execution.entry_price, type: "entry", hit: true });
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl", hit: !isLive && execution.exit_type === "SL" });
  }

  function dotColor(item: LevelItem) {
    if (item.type === "entry") return "var(--lucid-accent)";
    if (item.type === "sl") return item.hit ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
    return item.hit ? "var(--lucid-pos)" : "var(--lucid-ink-3)";
  }

  function labelColor(item: LevelItem) {
    if (item.type === "entry") return "var(--lucid-accent)";
    if (item.type === "sl") return item.hit ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
    return item.hit ? "var(--lucid-pos)" : "var(--lucid-ink-3)";
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
            {i > 0 && <div style={{ width: 2, height: 14, background: "var(--lucid-line)" }} />}
            <div
              style={{
                width: lvl.hit ? 10 : 8,
                height: lvl.hit ? 10 : 8,
                borderRadius: "50%",
                background: dotColor(lvl),
                border: lvl.hit ? "none" : "1px solid var(--lucid-line-2)",
                flexShrink: 0,
              }}
            />
            {i < levels.length - 1 && <div style={{ width: 2, height: 14, background: "var(--lucid-line)" }} />}
          </div>
          {/* Price */}
          <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink)", fontVariantNumeric: "tabular-nums" }}>
            {lvl.price}
          </span>
          {/* Partial note */}
          {lvl.type === "tp1" && execution.partial_exit_price && (
            <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginLeft: 4 }}>
              ({execution.partial_exit_lot_pct}% partial)
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// One card per account the idea was executed in — risk, size, exit, R, P&L.
// The primary is marked clearly: its outcome is the idea's outcome for edge
// statistics everywhere else in the app.
function ExecutionCard({ trade, execution, accountName }: { trade: Trade; execution: Execution; accountName?: string }) {
  const isLive = isExecutionOpen(execution);
  const pnlColor = execution.blended_pnl > 0 ? "var(--lucid-pos)" : execution.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const rrColor = execution.blended_rr > 0 ? "var(--lucid-pos)" : execution.blended_rr < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {execution.is_primary && <Star size={12} fill="var(--lucid-accent)" style={{ color: "var(--lucid-accent)" }} />}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lucid-ink)" }}>
            {accountName ?? execution.account_id}
          </span>
          {execution.is_primary && (
            <span className="pill" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)", fontSize: 10 }}>
              Primary
            </span>
          )}
        </div>
        {isLive ? (
          <span className="pill" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)", fontSize: 10 }}>Live</span>
        ) : (
          <span className="lx-value" style={{ fontWeight: 700, color: pnlColor }}>
            {execution.blended_pnl > 0 ? "+" : ""}{formatCurrency(execution.blended_pnl)}
          </span>
        )}
      </div>

      <ExecutionLadder trade={trade} execution={execution} />

      <div className="lx-rows" style={{ marginTop: 12 }}>
        {kv("Risk", `${execution.risk_pct}%`)}
        {kv("Lot Size", execution.lot_size)}
        {!isLive && kv("Pips", `${execution.total_pips > 0 ? "+" : ""}${execution.total_pips}`)}
        {!isLive && kv("R", <span style={{ color: rrColor }}>{execution.blended_rr}R</span>)}
        {!isLive && kv("Exit Type", execution.exit_type)}
        {kv("Closed", isLive ? <span style={{ color: "var(--lucid-pos)" }}>Running</span> : `${formatDate(execution.date_closed)} · ${formatTime(execution.date_closed)}`)}
        {kv("Held", heldDuration(trade.date_opened, execution.date_closed))}
      </div>
    </Card>
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
  accountNames,
  onEdit,
  onDelete,
}: {
  trade: Trade;
  /** account_id → display name, for the execution cards below. */
  accountNames?: Map<string, string>;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const primary = getPrimaryExecution(trade);
  const isLive = !primary || isExecutionOpen(primary);
  const config = pairs.find(p => p.symbol === trade.pair);
  // Total P&L is a dollar aggregate — sum across every execution (account
  // family). The idea's R, for edge purposes, is the primary execution's R.
  const totalPnl = trade.executions.reduce((s, e) => s + e.blended_pnl, 0);
  const primaryRr = primary?.blended_rr ?? 0;
  const pnlColor = totalPnl > 0 ? "var(--lucid-pos)" : totalPnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const rrColor = primaryRr > 0 ? "var(--lucid-pos)" : primaryRr < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const multiAccount = trade.executions.length > 1;

  return (
    <div className="flex flex-col">

      {/* Edit / Delete actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-end gap-2" style={{ marginBottom: 16 }}>
          {onEdit && (
            <button onClick={onEdit} className="lx-btn lx-btn-secondary" style={{ height: 32, paddingInline: 12, fontSize: 12.5 }}>
              <Pencil size={13} /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="lx-btn lx-btn-danger" style={{ height: 32, paddingInline: 12, fontSize: 12.5 }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}

      {/* Section 1: Outcome — the idea's edge outcome (primary execution's R),
          plus Total P&L, a dollar aggregate across every account it ran in. */}
      <Section first>
        <div className="flex items-start justify-between">
          {/* Total P&L */}
          <div>
            {isLive && trade.executions.every((e) => isExecutionOpen(e)) ? (
              <div className="flex items-center gap-2">
                <span className="pulse-live w-2 h-2 rounded-full" style={{ background: "var(--lucid-accent)", display: "inline-block" }} />
                <span className="lx-metric-sm" style={{ color: "var(--lucid-accent)" }}>Live</span>
              </div>
            ) : (
              <>
                <span className="lx-metric-sm" style={{ color: pnlColor }}>
                  {formatCurrency(totalPnl)}
                </span>
                <p className="lx-micro" style={{ marginTop: 4 }}>
                  Total P&L{multiAccount ? ` across ${trade.executions.length} accounts` : ""}
                </p>
              </>
            )}
          </div>

          {/* Primary R + pills */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span
                className="pill lx-value"
                style={{
                  background: "var(--lucid-surface-3)",
                  color: isLive ? "var(--lucid-ink-3)" : rrColor,
                  border: "1px solid var(--lucid-line-2)",
                }}
                title="The primary execution's R — the idea's outcome for edge statistics"
              >
                {isLive ? "—" : `${primaryRr}R`}
              </span>
              {multiAccount && (
                <span className="pill lx-value" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line-2)" }}>
                  {trade.executions.length} accounts
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="pill"
                style={{
                  background: trade.conviction === "High" ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
                  color: trade.conviction === "High" ? "var(--lucid-accent)" : "var(--lucid-ink-2)",
                  border: `1px solid ${trade.conviction === "High" ? "var(--lucid-accent-bd)" : "var(--lucid-line)"}`,
                }}
              >
                {trade.conviction} Conviction
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Setup — the idea, identical across every account */}
      <Section>
        <SectionTitle>Setup</SectionTitle>
        <div className="lx-rows">
          {kv("Pair",
            <span className="flex items-center gap-1">
              {config && <span>{config.flag_a}{config.flag_b}</span>}
              <span>{config?.display_name ?? trade.pair}</span>
            </span>
          )}
          {kv("Model", <ModelPill model={trade.model} />)}
          {kv("Direction",
            <span style={{ color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)", fontWeight: 600 }}>
              {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
            </span>
          )}
          {kv("Session", trade.session)}
          {kv("Opened", `${formatDate(trade.date_opened)} · ${formatTime(trade.date_opened)}`)}
        </div>
      </Section>

      {/* Section 3: Executions — one card per account this idea was taken in */}
      <Section>
        <SectionTitle>Executions ({trade.executions.length})</SectionTitle>
        <div className="flex flex-col gap-3">
          {trade.executions.map((execution) => (
            <ExecutionCard
              key={execution.id}
              trade={trade}
              execution={execution}
              accountName={accountNames?.get(execution.account_id)}
            />
          ))}
        </div>
      </Section>

      {/* Section 4: Context */}
      <Section>
        <SectionTitle>Context</SectionTitle>
        <div className="lx-rows">
          {kv("Lucid Score",
            <span className="lx-metric-sm" style={{ fontSize: 16, color: "var(--lucid-ink)" }}>
              {trade.fundamental_score ?? "—"}
            </span>
          )}
          {kv("Psychology",
            <span
              className="pill"
              style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}
            >
              {trade.psychology}
            </span>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <p className="lx-eyebrow" style={{ marginBottom: 6 }}>Notes</p>
          <p style={{ fontSize: 13, color: trade.notes ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)", fontStyle: trade.notes ? "normal" : "italic", lineHeight: 1.6 }}>
            {trade.notes || "No notes for this trade."}
          </p>
        </div>
      </Section>

      {/* Section 5: Screenshots */}
      <Section>
        <SectionTitle>Screenshots</SectionTitle>
        <ScreenshotGallery urls={trade.screenshots} tileHeight={150} />
      </Section>

      {/* Section 6: Memory */}
      <Section>
        <SectionTitle>Memory</SectionTitle>
        <div className="flex flex-col gap-3">

          {/* Card A — Pre-Trade Discussion */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--lucid-ink)" }}>Pre-Trade Discussion</p>
              {!trade.pre_trade_memory && (
                <span
                  className="pill"
                  style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.pre_trade_memory ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Setup</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.pre_trade_memory.setup_description}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fundamental Bias at Entry</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.pre_trade_memory.fundamental_bias_at_entry}</p>
                </div>
                {trade.pre_trade_memory.agreements.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Agreements</p>
                    <ul className="flex flex-col gap-1">
                      {trade.pre_trade_memory.agreements.map((a, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: "var(--lucid-pos)", lineHeight: 1.5 }}>
                          <span style={{ marginTop: 2, flexShrink: 0 }}>●</span>
                          <span style={{ color: "var(--lucid-ink-2)" }}>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trade.pre_trade_memory.disagreements.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Disagreements</p>
                    <ul className="flex flex-col gap-1">
                      {trade.pre_trade_memory.disagreements.map((d, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: "var(--lucid-warn)", lineHeight: 1.5 }}>
                          <span style={{ marginTop: 2, flexShrink: 0 }}>●</span>
                          <span style={{ color: "var(--lucid-ink-2)" }}>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", fontStyle: "italic", lineHeight: 1.6 }}>
                Lucid will save your pre-trade discussion here in Phase 3. You&apos;ll see your setup reasoning, fundamental bias at entry, and any disagreements with Lucid&apos;s analysis.
              </p>
            )}
          </Card>

          {/* Card B — Decision Reasoning */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--lucid-ink)" }}>Decision Reasoning</p>
              {!trade.pre_trade_memory && (
                <span
                  className="pill"
                  style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.pre_trade_memory?.decision_reasoning ? (
              <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>
                {trade.pre_trade_memory.decision_reasoning}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", fontStyle: "italic", lineHeight: 1.6 }}>
                Your decision reasoning will be saved here — why you took this trade, what the key variables were, and how confident you felt in the moment.
              </p>
            )}
          </Card>

          {/* Card C — Debrief */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--lucid-ink)" }}>Debrief</p>
              {!trade.debrief_memory && (
                <span
                  className="pill"
                  style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)", fontSize: 10 }}
                >
                  Phase 3
                </span>
              )}
            </div>
            {trade.debrief_memory ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome Summary</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.debrief_memory.outcome_summary}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expectation vs Reality</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.debrief_memory.expectation_vs_reality}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Decision Quality</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.debrief_memory.decision_quality_note}</p>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", fontStyle: "italic", lineHeight: 1.6 }}>
                  Debrief notes will appear here after the trade closes. What happened vs. what you expected, and what you&apos;d do differently.
                </p>
                <button
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: "var(--lucid-surface-3)",
                    border: "1px solid var(--lucid-line-2)",
                    color: "var(--lucid-ink-2)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--lucid-surface-2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--lucid-surface-3)"; }}
                >
                  Add Debrief Note
                </button>
              </>
            )}
          </Card>
        </div>
      </Section>
    </div>
  );
}
