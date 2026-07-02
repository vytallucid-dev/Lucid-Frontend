"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/demo-data";
import { useTrades, useAccounts, useTradingPairs, useDeleteTrade } from "@/hooks/useTrading";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { LoadingState } from "@/components/state/LoadingState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/toast";
import { TradeDrawerContent } from "../TradeDrawerContent";
import { AddTradeModal } from "../AddTradeModal";

export default function TradeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const tradesQuery = useTrades();
  const accountsQuery = useAccounts();
  const pairsQuery = useTradingPairs();
  const deleteTrade = useDeleteTrade();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trade = (tradesQuery.data ?? []).find(t => t.id === id);
  const config = (pairsQuery.data ?? []).find(p => p.symbol === trade?.pair);
  const accountName =
    (accountsQuery.data ?? []).find(a => a.id === trade?.account_id)?.account_name ?? trade?.account_id ?? "—";

  if (tradesQuery.isLoading) {
    return (
      <DetailPageLayout backHref="/trading/journal" backLabel="Journal" title="Trade">
        <LoadingState message="Loading trade…" />
      </DetailPageLayout>
    );
  }

  if (!trade) {
    return (
      <DetailPageLayout backHref="/trading/journal" backLabel="Journal" title="Trade not found">
        <div className="py-16 text-center" style={{ color: "var(--lucid-ink-3)", fontSize: 14 }}>
          This trade could not be found. It may have been deleted.
        </div>
      </DetailPageLayout>
    );
  }

  const isLive = !trade.date_closed;
  const pnlColor = trade.blended_pnl > 0 ? "var(--lucid-pos)" : trade.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const pairDisplay = config?.display_name ?? trade.pair;

  const actions = (
    <>
      <button
        onClick={() => setEditOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
        style={{ color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}
      >
        <Pencil size={14} /> Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </>
  );

  return (
    <DetailPageLayout
      backHref="/trading/journal"
      backLabel="Journal"
      title={`Trade #${trade.id.slice(0, 8)}`}
      actions={actions}
    >
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex items-center gap-4">
          {/* Pair + flags */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {config && <span className="text-2xl">{config.flag_a}{config.flag_b}</span>}
              <h2 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>
                {pairDisplay}
              </h2>
              <span
                className="pill"
                style={{
                  background: trade.direction === "Buy" ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)",
                  color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)",
                  border: `1px solid ${trade.direction === "Buy" ? "var(--lucid-pos-bd)" : "var(--lucid-neg-bd)"}`,
                  fontSize: 13,
                  padding: "3px 10px",
                }}
              >
                {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--lucid-ink-3)" }}>
              {formatDate(trade.date_opened)}
              {" · "}
              <span
                style={{
                  color: trade.conviction === "High" ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
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
              <span className="pulse-live w-2.5 h-2.5 rounded-full" style={{ background: "var(--lucid-accent)", display: "inline-block" }} />
              <span className="lt-num" style={{ fontSize: 32, fontWeight: 700, color: "var(--lucid-accent)" }}>Live</span>
            </div>
          ) : (
            <span className="lt-num" style={{ fontSize: 32, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(trade.blended_pnl)}
            </span>
          )}
          {!isLive && (
            <p className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink-3)", marginTop: 4 }}>
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
              style={{ color: "var(--lucid-ink-3)", letterSpacing: "0.08em" }}
            >
              Screenshots
            </p>
            {trade.screenshots.length === 0 ? (
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  height: 160,
                  background: "var(--lucid-surface)",
                  border: "1px solid var(--lucid-line)",
                  color: "var(--lucid-ink-3)",
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
                      background: `url(${src}) center/cover, var(--lucid-surface)`,
                      border: "1px solid var(--lucid-line)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quick stats card */}
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}
          >
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: "var(--lucid-ink-3)", letterSpacing: "0.08em" }}>
              Quick Stats
            </p>
            {[
              ["Account", accountName],
              ["Model", trade.model],
              ["Lot Size", trade.lot_size],
              ["Risk", `${trade.risk_pct}%`],
              ["Session", trade.session],
              ["Lucid Score", trade.fundamental_score != null ? String(trade.fundamental_score) : "—"],
              ["Psychology", trade.psychology || "—"],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid var(--lucid-line)", fontSize: 13 }}
              >
                <span style={{ color: "var(--lucid-ink-3)" }}>{label}</span>
                <span style={{ color: "var(--lucid-ink-2)", fontVariantNumeric: "tabular-nums" }}>{value as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AddTradeModal open={editOpen} editTrade={trade} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete trade?"
        message={`This ${trade.pair} ${trade.direction} trade will be permanently deleted. Account balances update accordingly.`}
        confirmLabel="Delete"
        loading={deleteTrade.isPending}
        onConfirm={() =>
          deleteTrade.mutate(trade.id, {
            onSuccess: () => { toast.success("Trade deleted."); router.push("/trading/journal"); },
            onSettled: () => setConfirmDelete(false),
          })
        }
        onCancel={() => setConfirmDelete(false)}
      />
    </DetailPageLayout>
  );
}
