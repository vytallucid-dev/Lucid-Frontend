"use client";

import { type Trade, pairs, formatCurrency, formatDate } from "@/lib/demo-data";

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Breakout:    { bg: "rgba(168,85,247,0.12)",  color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    Short:       { bg: "rgba(148,163,184,0.1)",  color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
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
        background: isBuy ? "var(--positive-bg)" : "var(--negative-bg)",
        color: isBuy ? "var(--positive)" : "var(--negative)",
        border: `1px solid ${isBuy ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}
    >
      {isBuy ? "↑" : "↓"} {direction}
    </span>
  );
}

export function JournalGallery({ trades, onCardClick }: { trades: Trade[]; onCardClick: (t: Trade) => void }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {trades.map(trade => {
        const isLive = !trade.date_closed;
        const config = pairs.find(p => p.symbol === trade.pair);
        const pnlColor = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";
        const accentColor = isLive ? "#3B82F6" : trade.conviction === "High" ? "#3B82F6" : trade.conviction === "Medium" ? "#475569" : "transparent";

        return (
          <div
            key={trade.id}
            onClick={() => onCardClick(trade)}
            className="relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-transform"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              height: 280,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(148,163,184,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(148,163,184,0.1)"; }}
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
                <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#E2E8F0" }}>
                  {config && <span>{config.flag_a}{config.flag_b}</span>}
                  {config?.display_name ?? trade.pair}
                </span>
                <DirectionPill direction={trade.direction} />
              </div>

              {/* Date */}
              <p className="text-xs mb-3" style={{ color: "#64748B" }}>
                {formatDate(trade.date_opened)}
              </p>

              {/* Chart preview / placeholder */}
              <div
                className="flex-1 rounded-lg mb-3 flex items-center justify-center"
                style={{
                  background: trade.screenshots.length > 0
                    ? `url(${trade.screenshots[0]}) center/cover`
                    : `linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(148,163,184,0.05) 100%)`,
                  border: "1px solid rgba(148,163,184,0.06)",
                  minHeight: 80,
                }}
              >
                {trade.screenshots.length === 0 && (
                  <span style={{ fontSize: 11, color: "#334155" }}>No chart</span>
                )}
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-3 mb-2">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isLive ? "#64748B" : (trade.total_pips > 0 ? "var(--positive)" : trade.total_pips < 0 ? "var(--negative)" : "#94A3B8"),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isLive ? "—" : (trade.total_pips > 0 ? `+${trade.total_pips}` : trade.total_pips) + " pips"}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isLive ? "#64748B" : (trade.blended_rr > 0 ? "var(--positive)" : trade.blended_rr < 0 ? "var(--negative)" : "#94A3B8"),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isLive ? "—" : `${trade.blended_rr}R`}
                </span>
              </div>

              {/* P&L */}
              <div className="mb-3">
                {isLive ? (
                  <span className="flex items-center gap-1.5" style={{ color: "#93C5FD", fontSize: 18, fontWeight: 700 }}>
                    <span className="pulse-live w-2 h-2 rounded-full" style={{ background: "#3B82F6", display: "inline-block" }} />
                    Live
                  </span>
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
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
                      ? "var(--positive-bg)" : trade.exit_type === "SL" || trade.exit_type === "Partial+SL"
                      ? "var(--negative-bg)" : trade.exit_type === "Manual"
                      ? "var(--warning-bg)" : "rgba(148,163,184,0.1)",
                    color: trade.exit_type === "TP" || trade.exit_type === "Partial+TP"
                      ? "var(--positive)" : trade.exit_type === "SL" || trade.exit_type === "Partial+SL"
                      ? "var(--negative)" : trade.exit_type === "Manual"
                      ? "var(--warning)" : "#94A3B8",
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
