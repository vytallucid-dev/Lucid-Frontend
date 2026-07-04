"use client";

import { type Trade, pairs, formatCurrency, formatDate } from "@/lib/demo-data";

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    Breakout:    { bg: "var(--lucid-ctx-bg)",  color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Short:       { bg: "var(--lucid-surface-3)",  color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{model}</span>;
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

export function JournalGallery({ trades, onCardClick }: { trades: Trade[]; onCardClick: (t: Trade) => void }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {trades.map((trade, idx) => {
        const isLive = !trade.date_closed;
        const config = pairs.find(p => p.symbol === trade.pair);
        const pnlColor = trade.blended_pnl > 0 ? "var(--lucid-pos)" : trade.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
        const accentColor = isLive ? "var(--lucid-accent)" : trade.conviction === "High" ? "var(--lucid-accent)" : trade.conviction === "Medium" ? "var(--lucid-ink-3)" : "transparent";

        return (
          <div
            key={trade.id}
            onClick={() => onCardClick(trade)}
            className="lt-lift lt-rise relative flex flex-col rounded-xl overflow-hidden cursor-pointer"
            style={{
              background: "var(--lucid-grad-surface)",
              border: "1px solid var(--lucid-line)",
              boxShadow: "var(--lucid-elev-1)",
              height: 280,
              animationDelay: `${Math.min(idx * 0.04, 0.4)}s`,
            }}
          >
            {/* Conviction accent strip */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: accentColor,
              }}
              className={isLive ? "pulse-live" : undefined}
            />

            <div className="flex flex-col flex-1 pl-5 pr-4 pt-4 pb-4 ml-1">
              {/* Top: pair + direction */}
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                  {config && <span>{config.flag_a}{config.flag_b}</span>}
                  {config?.display_name ?? trade.pair}
                </span>
                <DirectionPill direction={trade.direction} />
              </div>

              {/* Date */}
              <p className="text-xs mb-3 lt-num" style={{ color: "var(--lucid-ink-3)" }}>
                {formatDate(trade.date_opened)}
              </p>

              {/* Chart preview / placeholder */}
              <div
                className="flex-1 rounded-lg mb-3 flex items-center justify-center"
                style={{
                  background: trade.screenshots.length > 0
                    ? `url(${trade.screenshots[0]}) center/cover`
                    : `linear-gradient(135deg, var(--lucid-accent-bg) 0%, var(--lucid-surface-3) 100%)`,
                  border: "1px solid var(--lucid-line)",
                  minHeight: 80,
                }}
              >
                {trade.screenshots.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>No chart</span>
                )}
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="lt-num"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isLive ? "var(--lucid-ink-3)" : (trade.total_pips > 0 ? "var(--lucid-pos)" : trade.total_pips < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)"),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isLive ? "—" : (trade.total_pips > 0 ? `+${trade.total_pips}` : trade.total_pips) + " pips"}
                </span>
                <span
                  className="lt-num"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isLive ? "var(--lucid-ink-3)" : (trade.blended_rr > 0 ? "var(--lucid-pos)" : trade.blended_rr < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)"),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isLive ? "—" : `${trade.blended_rr}R`}
                </span>
              </div>

              {/* P&L */}
              <div className="mb-3">
                {isLive ? (
                  <span className="flex items-center gap-1.5" style={{ color: "var(--lucid-accent)", fontSize: 18, fontWeight: 700 }}>
                    <span className="pulse-live w-2 h-2 rounded-full" style={{ background: "var(--lucid-accent)", display: "inline-block" }} />
                    Live
                  </span>
                ) : (
                  <span className="lt-num" style={{ fontSize: 18, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(trade.blended_pnl)}
                  </span>
                )}
              </div>

              {/* Pills row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <ModelPill model={trade.model} />
                <span
                  className="pill"
                  style={{
                    background: trade.exit_type === "TP" || trade.exit_type === "Partial+TP"
                      ? "var(--lucid-pos-bg)" : trade.exit_type === "SL" || trade.exit_type === "Partial+SL"
                      ? "var(--lucid-neg-bg)" : trade.exit_type === "Manual"
                      ? "var(--lucid-warn-bg)" : "var(--lucid-surface-3)",
                    color: trade.exit_type === "TP" || trade.exit_type === "Partial+TP"
                      ? "var(--lucid-pos)" : trade.exit_type === "SL" || trade.exit_type === "Partial+SL"
                      ? "var(--lucid-neg)" : trade.exit_type === "Manual"
                      ? "var(--lucid-warn)" : "var(--lucid-ink-2)",
                    border: "1px solid var(--lucid-line)",
                  }}
                >
                  {trade.exit_type}
                </span>
                <span
                  className="pill"
                  style={{
                    background: trade.conviction === "High" ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
                    color: trade.conviction === "High" ? "var(--lucid-accent)" : "var(--lucid-ink-2)",
                    border: `1px solid ${trade.conviction === "High" ? "var(--lucid-accent-bd)" : "var(--lucid-line-2)"}`,
                  }}
                >
                  {trade.conviction}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
