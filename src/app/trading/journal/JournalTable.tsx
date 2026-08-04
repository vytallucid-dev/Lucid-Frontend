"use client";

import { Layers } from "lucide-react";
import { type Trade, pairs, formatCurrency, formatDate } from "@/lib/demo-data";
import { getPrimaryExecution, isExecutionOpen, tradeAccountCount } from "@/lib/trade-helpers";

function getConvictionClass(conviction: string, isLive: boolean): string {
  if (isLive) return "row-live";
  if (conviction === "High") return "row-conviction-high";
  if (conviction === "Medium") return "row-conviction-medium";
  return "row-conviction-low";
}

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    Breakout:    { bg: "var(--lucid-ctx-bg)",  color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Short:       { bg: "var(--lucid-surface-3)",  color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return (
    <span
      className="pill"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {model}
    </span>
  );
}

function DirectionPill({ direction }: { direction: string }) {
  const isBuy = direction === "Buy";
  return (
    <span
      className="pill"
      style={{
        background: isBuy ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)",
        color: isBuy ? "var(--lucid-pos)" : "var(--lucid-neg)",
        border: `1px solid ${isBuy ? "var(--lucid-pos-bd)" : "var(--lucid-neg-bd)"}`,
      }}
    >
      {isBuy ? "↑" : "↓"} {direction}
    </span>
  );
}

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP:           { bg: "var(--lucid-pos-bg)",              color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    "Partial+TP": { bg: "var(--lucid-pos-bg)",              color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    SL:           { bg: "var(--lucid-neg-bg)",              color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    "Partial+SL": { bg: "var(--lucid-neg-bg)",              color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    Manual:       { bg: "var(--lucid-warn-bg)",               color: "var(--lucid-warn)",  border: "var(--lucid-warn-bd)" },
    BE:           { bg: "var(--lucid-surface-3)",           color: "var(--lucid-ink-2)",         border: "var(--lucid-line-2)" },
  };
  const s = map[type] ?? map["BE"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {type}
    </span>
  );
}

function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High")
    return <span className="pill" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}>High</span>;
  if (conviction === "Medium")
    return <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}>Medium</span>;
  return <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>Low</span>;
}

function PairCell({ pair }: { pair: string }) {
  const config = pairs.find(p => p.symbol === pair);
  if (!config) return <span style={{ color: "var(--lucid-ink)" }}>{pair}</span>;
  return (
    <span className="flex items-center gap-1">
      <span>{config.flag_a}{config.flag_b}</span>
      <span style={{ color: "var(--lucid-ink)", fontWeight: 500 }}>{config.display_name}</span>
    </span>
  );
}

/** How many accounts this idea was executed across — a small badge so a
 * multi-account idea is visible at a glance. Not shown for single-account ideas. */
function AccountsBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span
      className="pill"
      style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)", display: "inline-flex", alignItems: "center", gap: 3 }}
      title={`Executed across ${count} accounts`}
    >
      <Layers size={10} /> {count}
    </span>
  );
}

const TH_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--lucid-ink-3)",
  whiteSpace: "nowrap",
  userSelect: "none",
};

// A row is an idea. Exit/pips/R/P&L come from the PRIMARY execution — or, when
// `trades` has been pre-filtered to one account (see the Journal page's
// account filter), from that account's own single execution: getPrimaryExecution
// falls back to the only execution present, so both cases resolve correctly
// with no special-casing here.
export function JournalTable({ trades, onRowClick }: { trades: Trade[]; onRowClick: (t: Trade) => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--lucid-line)", background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 1020 }}>
          <colgroup>
            <col style={{ width: 4 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 95 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              <th style={{ ...TH_STYLE, padding: 0 }} />
              <th style={TH_STYLE}>Date</th>
              <th style={TH_STYLE}>Pair</th>
              <th style={TH_STYLE}>Model</th>
              <th style={TH_STYLE}>Dir</th>
              <th style={{ ...TH_STYLE, fontVariantNumeric: "tabular-nums" }}>Planned Entry</th>
              <th style={{ ...TH_STYLE, fontVariantNumeric: "tabular-nums" }}>Exit</th>
              <th style={TH_STYLE}>Pips</th>
              <th style={TH_STYLE}>R:R</th>
              <th style={TH_STYLE}>P&amp;L</th>
              <th style={TH_STYLE}>Exit Type</th>
              <th style={TH_STYLE}>Conviction</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => {
              const primary = getPrimaryExecution(trade);
              const isLive = !primary || isExecutionOpen(primary);
              const pips = primary?.total_pips ?? 0;
              const rr = primary?.blended_rr ?? 0;
              const pnl = primary?.blended_pnl ?? 0;
              const pipsColor = pips > 0 ? "var(--lucid-pos)" : pips < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              const rrColor = rr > 0 ? "var(--lucid-pos)" : rr < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              const accountCount = tradeAccountCount(trade);

              return (
                <tr
                  key={trade.id}
                  onClick={() => onRowClick(trade)}
                  className="trade-row"
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--lucid-line)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  {/* Conviction accent */}
                  <td
                    style={{
                      padding: 0,
                      width: 4,
                      background: isLive
                        ? "transparent"
                        : trade.conviction === "High"
                        ? "var(--lucid-accent)"
                        : trade.conviction === "Medium"
                        ? "var(--lucid-ink-3)"
                        : "transparent",
                    }}
                  >
                    {isLive && (
                      <div
                        className="pulse-live w-full h-full"
                        style={{ background: "var(--lucid-accent)", width: 4, height: "100%", minHeight: 44 }}
                      />
                    )}
                  </td>

                  {/* Date */}
                  <td className="lt-num" style={{ padding: "0 12px", height: 44, color: "var(--lucid-ink-2)", fontSize: 13 }}>
                    {formatDate(trade.date_opened).replace(/, \d{4}$/, "")}
                  </td>

                  {/* Pair */}
                  <td style={{ padding: "0 12px", fontSize: 13 }}>
                    <div className="flex items-center gap-1.5">
                      <PairCell pair={trade.pair} />
                      <AccountsBadge count={accountCount} />
                    </div>
                  </td>

                  {/* Model */}
                  <td style={{ padding: "0 12px" }}>
                    <ModelPill model={trade.model} />
                  </td>

                  {/* Direction */}
                  <td style={{ padding: "0 12px" }}>
                    <DirectionPill direction={trade.direction} />
                  </td>

                  {/* Planned Entry */}
                  <td className="lt-num" style={{ padding: "0 12px", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--lucid-ink)" }}>
                    {trade.planned_entry}
                  </td>

                  {/* Exit (primary execution, or the filtered account's) */}
                  <td className="lt-num" style={{ padding: "0 12px", fontSize: 13, fontVariantNumeric: "tabular-nums", color: isLive ? "var(--lucid-ink-3)" : "var(--lucid-ink)" }}>
                    {isLive ? "—" : primary!.main_exit_price}
                  </td>

                  {/* Pips */}
                  <td className="lt-num" style={{ padding: "0 12px", fontSize: 13, fontWeight: 600, color: isLive ? "var(--lucid-ink-3)" : pipsColor, fontVariantNumeric: "tabular-nums" }}>
                    {isLive ? "—" : (pips > 0 ? `+${pips}` : `${pips}`)}
                  </td>

                  {/* R:R */}
                  <td className="lt-num" style={{ padding: "0 12px", fontSize: 13, fontWeight: 600, color: isLive ? "var(--lucid-ink-3)" : rrColor, fontVariantNumeric: "tabular-nums" }}>
                    {isLive ? "—" : `${rr}R`}
                  </td>

                  {/* P&L */}
                  <td style={{ padding: "0 12px" }}>
                    {isLive ? (
                      <span className="flex items-center gap-1.5" style={{ color: "var(--lucid-accent)", fontSize: 13, fontWeight: 700 }}>
                        <span className="pulse-live w-1.5 h-1.5 rounded-full" style={{ background: "var(--lucid-accent)", display: "inline-block" }} />
                        Live
                      </span>
                    ) : (
                      <span className="lt-num" style={{ fontSize: 13, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(pnl)}
                      </span>
                    )}
                  </td>

                  {/* Exit Type */}
                  <td style={{ padding: "0 12px" }}>
                    {primary && <ExitTypePill type={primary.exit_type} />}
                  </td>

                  {/* Conviction */}
                  <td style={{ padding: "0 12px" }}>
                    <ConvictionPill conviction={trade.conviction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
