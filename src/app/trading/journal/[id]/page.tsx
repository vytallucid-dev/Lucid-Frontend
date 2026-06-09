"use client";

import { notFound } from "next/navigation";
import { trades, pairs, formatCurrency, formatDate, formatTime, type Trade } from "@/lib/demo-data";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { TradeDrawerContent } from "../TradeDrawerContent";

function getPairDisplay(trade: Trade) {
  return pairs.find(p => p.symbol === trade.pair)?.display_name ?? trade.pair;
}

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const trade = trades.find(t => t.id === params.id);
  if (!trade) notFound();

  const isLive = !trade.date_closed;
  const config = pairs.find(p => p.symbol === trade.pair);
  const pnlColor = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";

  return (
    <DetailPageLayout
      backHref="/trading/journal"
      backLabel="Journal"
      title={`Trade #${trade.id.replace("trd_", "")}`}
    >
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex items-center gap-4">
          {/* Pair + flags */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {config && <span className="text-2xl">{config.flag_a}{config.flag_b}</span>}
              <h2 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>
                {getPairDisplay(trade)}
              </h2>
              <span
                className="pill"
                style={{
                  background: trade.direction === "Buy" ? "var(--positive-bg)" : "var(--negative-bg)",
                  color: trade.direction === "Buy" ? "var(--positive)" : "var(--negative)",
                  border: `1px solid ${trade.direction === "Buy" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                  fontSize: 13,
                  padding: "3px 10px",
                }}
              >
                {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
              {formatDate(trade.date_opened)}
              {" · "}
              <span
                style={{
                  color: trade.conviction === "High" ? "var(--accent-blue)" : "#64748B",
                  fontWeight: trade.conviction === "High" ? 600 : 400,
                }}
              >
                {trade.conviction} Conviction
              </span>
            </p>
          </div>
        </div>

        {/* P&L summary */}
        <div className="sm:text-right">
          {isLive ? (
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="pulse-live w-2.5 h-2.5 rounded-full" style={{ background: "#3B82F6", display: "inline-block" }} />
              <span style={{ fontSize: 32, fontWeight: 700, color: "#93C5FD" }}>Live</span>
            </div>
          ) : (
            <span style={{ fontSize: 32, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(trade.blended_pnl)}
            </span>
          )}
          {!isLive && (
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
              {trade.total_pips > 0 ? "+" : ""}{trade.total_pips} pips · {trade.blended_rr}R
            </p>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">

        {/* Left column: main trade content (reuses drawer content) */}
        <div>
          <TradeDrawerContent trade={trade} />
        </div>

        {/* Right column: Screenshots + Context */}
        <div className="flex flex-col gap-5">
          {/* Screenshots gallery */}
          <div>
            <p
              className="text-xs font-semibold uppercase mb-3"
              style={{ color: "#64748B", letterSpacing: "0.08em" }}
            >
              Screenshots
            </p>
            {trade.screenshots.length === 0 ? (
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  height: 160,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "#334155",
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                No screenshots attached.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {trade.screenshots.map((src, i) => (
                  <div
                    key={i}
                    className="rounded-xl w-full"
                    style={{
                      height: 200,
                      background: `url(${src}) center/cover, rgba(148,163,184,0.05)`,
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quick stats card */}
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: "#64748B", letterSpacing: "0.08em" }}>
              Quick Stats
            </p>
            {[
              ["Account", trade.account_id],
              ["Model", trade.model],
              ["Lot Size", trade.lot_size],
              ["Risk", `${trade.risk_pct}%`],
              ["Session", trade.session],
              ["Fundamental", trade.fundamental_score ? `${trade.fundamental_score}/10` : "—"],
              ["Psychology", trade.psychology],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid rgba(148,163,184,0.05)", fontSize: 13 }}
              >
                <span style={{ color: "#64748B" }}>{label}</span>
                <span style={{ color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{value as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DetailPageLayout>
  );
}
