"use client";

import { type Trade, pairs, formatCurrency, formatDate } from "@/lib/demo-data";

function getConvictionClass(conviction: string, isLive: boolean): string {
  if (isLive) return "row-live";
  if (conviction === "High") return "row-conviction-high";
  if (conviction === "Medium") return "row-conviction-medium";
  return "row-conviction-low";
}

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Breakout:    { bg: "rgba(168,85,247,0.12)",  color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    Short:       { bg: "rgba(148,163,184,0.1)",  color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
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
        background: isBuy ? "var(--positive-bg)" : "var(--negative-bg)",
        color: isBuy ? "var(--positive)" : "var(--negative)",
        border: `1px solid ${isBuy ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}
    >
      {isBuy ? "↑" : "↓"} {direction}
    </span>
  );
}

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP:           { bg: "var(--positive-bg)",              color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    "Partial+TP": { bg: "var(--positive-bg)",              color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    SL:           { bg: "var(--negative-bg)",              color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    "Partial+SL": { bg: "var(--negative-bg)",              color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    Manual:       { bg: "var(--warning-bg)",               color: "var(--warning)",  border: "rgba(245,158,11,0.25)" },
    BE:           { bg: "rgba(148,163,184,0.1)",           color: "#94A3B8",         border: "rgba(148,163,184,0.2)" },
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
    return <span className="pill pill-blue">High</span>;
  if (conviction === "Medium")
    return <span className="pill" style={{ background: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.2)" }}>Medium</span>;
  return <span className="pill" style={{ background: "rgba(100,116,139,0.1)", color: "#64748B", border: "1px solid rgba(100,116,139,0.15)" }}>Low</span>;
}

function PairCell({ pair }: { pair: string }) {
  const config = pairs.find(p => p.symbol === pair);
  if (!config) return <span style={{ color: "#E2E8F0" }}>{pair}</span>;
  return (
    <span className="flex items-center gap-1">
      <span>{config.flag_a}{config.flag_b}</span>
      <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{config.display_name}</span>
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
  color: "#64748B",
  whiteSpace: "nowrap",
  userSelect: "none",
};

export function JournalTable({ trades, onRowClick }: { trades: Trade[]; onRowClick: (t: Trade) => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
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
            <col style={{ width: 60 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 95 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
              <th style={{ ...TH_STYLE, padding: 0 }} />
              <th style={TH_STYLE}>Date</th>
              <th style={TH_STYLE}>Pair</th>
              <th style={TH_STYLE}>Model</th>
              <th style={TH_STYLE}>Dir</th>
              <th style={{ ...TH_STYLE, fontVariantNumeric: "tabular-nums" }}>Entry</th>
              <th style={{ ...TH_STYLE, fontVariantNumeric: "tabular-nums" }}>Exit</th>
              <th style={TH_STYLE}>Pips</th>
              <th style={TH_STYLE}>Risk</th>
              <th style={TH_STYLE}>R:R</th>
              <th style={TH_STYLE}>P&amp;L</th>
              <th style={TH_STYLE}>Exit Type</th>
              <th style={TH_STYLE}>Conviction</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => {
              const isLive = !trade.date_closed;
              const pipsColor = trade.total_pips > 0 ? "var(--positive)" : trade.total_pips < 0 ? "var(--negative)" : "#94A3B8";
              const rrColor = trade.blended_rr > 0 ? "var(--positive)" : trade.blended_rr < 0 ? "var(--negative)" : "#94A3B8";
              const pnlColor = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";

              return (
                <tr
                  key={trade.id}
                  onClick={() => onRowClick(trade)}
                  className="trade-row"
                  style={{ cursor: "pointer", borderBottom: "1px solid rgba(148,163,184,0.05)" }}
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
                        ? "var(--accent-blue)"
                        : trade.conviction === "Medium"
                        ? "#475569"
                        : "transparent",
                      boxShadow: isLive
                        ? undefined
                        : trade.conviction === "High"
                        ? "inset 8px 0 16px -8px rgba(59,130,246,0.25)"
                        : undefined,
                    }}
                  >
                    {isLive && (
                      <div
                        className="pulse-live w-full h-full"
                        style={{ background: "var(--accent-blue)", width: 4, height: "100%", minHeight: 44 }}
                      />
                    )}
                  </td>

                  {/* Date */}
                  <td style={{ padding: "0 12px", height: 44, color: "#94A3B8", fontSize: 13 }}>
                    {formatDate(trade.date_opened).replace(/, \d{4}$/, "")}
                  </td>

                  {/* Pair */}
                  <td style={{ padding: "0 12px", fontSize: 13 }}>
                    <PairCell pair={trade.pair} />
                  </td>

                  {/* Model */}
                  <td style={{ padding: "0 12px" }}>
                    <ModelPill model={trade.model} />
                  </td>

                  {/* Direction */}
                  <td style={{ padding: "0 12px" }}>
                    <DirectionPill direction={trade.direction} />
                  </td>

                  {/* Entry */}
                  <td style={{ padding: "0 12px", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "#E2E8F0" }}>
                    {trade.entry_price}
                  </td>

                  {/* Exit */}
                  <td style={{ padding: "0 12px", fontSize: 13, fontVariantNumeric: "tabular-nums", color: isLive ? "#64748B" : "#E2E8F0" }}>
                    {isLive ? "—" : trade.main_exit_price}
                  </td>

                  {/* Pips */}
                  <td style={{ padding: "0 12px", fontSize: 13, fontWeight: 600, color: isLive ? "#64748B" : pipsColor, fontVariantNumeric: "tabular-nums" }}>
                    {isLive ? "—" : (trade.total_pips > 0 ? `+${trade.total_pips}` : `${trade.total_pips}`)}
                  </td>

                  {/* Risk */}
                  <td style={{ padding: "0 12px", fontSize: 13, color: "#94A3B8" }}>
                    {trade.risk_pct}%
                  </td>

                  {/* R:R */}
                  <td style={{ padding: "0 12px", fontSize: 13, fontWeight: 600, color: isLive ? "#64748B" : rrColor, fontVariantNumeric: "tabular-nums" }}>
                    {isLive ? "—" : `${trade.blended_rr > 0 ? "" : ""}${trade.blended_rr}R`}
                  </td>

                  {/* P&L */}
                  <td style={{ padding: "0 12px" }}>
                    {isLive ? (
                      <span className="flex items-center gap-1.5" style={{ color: "#93C5FD", fontSize: 13, fontWeight: 700 }}>
                        <span className="pulse-live w-1.5 h-1.5 rounded-full" style={{ background: "#3B82F6", display: "inline-block" }} />
                        Live
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(trade.blended_pnl)}
                      </span>
                    )}
                  </td>

                  {/* Exit Type */}
                  <td style={{ padding: "0 12px" }}>
                    <ExitTypePill type={trade.exit_type} />
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
