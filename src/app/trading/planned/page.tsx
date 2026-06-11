"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  pairs,
  type PlannedTrade,
  type PlannedStatus,
  getDistanceToEntry,
} from "@/lib/demo-data";
import { usePlanned, useUpdatePlanned, useDeletePlanned } from "@/hooks/useTrading";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { AddPlannedTradeModal } from "./AddPlannedTradeModal";
import { PlannedDrawerContent, calcRR, ModelPill, ConvictionPill, DistanceBadge } from "./PlannedDrawerContent";
import { AddTradeModal } from "../journal/AddTradeModal";

// ── Status section config ─────────────────────────────────────────────────────
const STATUS_ORDER: PlannedStatus[] = ["Ready", "Watching", "Invalidated", "Cancelled"];

const STATUS_STYLE: Record<PlannedStatus, { label: string; color: string; barColor: string }> = {
  Ready:       { label: "READY",       color: "#F59E0B", barColor: "#F59E0B" },
  Watching:    { label: "WATCHING",    color: "#93C5FD", barColor: "#3B82F6" },
  Invalidated: { label: "INVALIDATED", color: "#64748B", barColor: "#475569" },
  Cancelled:   { label: "CANCELLED",   color: "#475569", barColor: "#334155" },
};

// ── Filter chips ──────────────────────────────────────────────────────────────
const FILTER_OPTIONS: Array<PlannedStatus | "All"> = ["All", "Watching", "Ready", "Invalidated", "Cancelled"];

// ── Row-level more-menu ───────────────────────────────────────────────────────
function MoreMenu({
  trade,
  onEdit,
  onInvalidate,
  onCancel,
  onDelete,
}: {
  trade: PlannedTrade;
  onEdit: () => void;
  onInvalidate: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const items: Array<{ label: string; action: () => void; danger?: boolean }> = [
    { label: "Edit", action: onEdit },
    ...(trade.status !== "Invalidated" ? [{ label: "Mark as Invalidated", action: onInvalidate }] : []),
    ...(trade.status !== "Cancelled" ? [{ label: "Mark as Cancelled", action: onCancel }] : []),
    { label: "Delete", action: onDelete, danger: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 rounded-md transition-colors hover:bg-white/5"
        style={{ color: "#64748B" }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-30 rounded-xl py-1 min-w-43"
          style={{
            background: "rgba(15,23,36,0.98)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          {items.map(item => (
            <button
              key={item.label}
              onClick={e => { e.stopPropagation(); item.action(); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: item.danger ? "#EF4444" : "#E2E8F0" }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pair cell ─────────────────────────────────────────────────────────────────
function PairCell({ pair }: { pair: string }) {
  const config = pairs.find(p => p.symbol === pair);
  if (!config) return <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{pair}</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ fontSize: 14 }}>{config.flag_a}{config.flag_b}</span>
      <span style={{ color: "#E2E8F0", fontWeight: 500, fontSize: 13 }}>{config.display_name}</span>
    </span>
  );
}

// ── Planned trade row ─────────────────────────────────────────────────────────
function PlannedRow({
  trade,
  statusColor,
  onRowClick,
  onConvert,
  onInvalidate,
  onCancel,
  onDelete,
  onEdit,
}: {
  trade: PlannedTrade;
  statusColor: string;
  onRowClick: () => void;
  onConvert: () => void;
  onInvalidate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const rr = calcRR(trade);
  const dist = getDistanceToEntry(trade);
  const canConvert = trade.status === "Watching" || trade.status === "Ready";
  const currentAboveEntry = trade.current_market_price > trade.planned_entry;
  const isFavorable =
    trade.direction === "Buy" ? !currentAboveEntry : currentAboveEntry;
  const priceColor = dist.direction === "at" ? "#10B981" : isFavorable ? "#10B981" : "#EF4444";

  return (
    <tr
      onClick={onRowClick}
      className="transition-colors cursor-pointer"
      style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(148,163,184,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Status bar */}
      <td style={{ padding: 0, width: 4 }}>
        <div style={{ width: 4, height: 44, background: statusColor, borderRadius: "2px 0 0 2px" }} />
      </td>

      {/* Pair */}
      <td style={{ padding: "10px 12px", width: 120 }}>
        <PairCell pair={trade.pair} />
      </td>

      {/* Model */}
      <td style={{ padding: "10px 8px", width: 110 }}>
        <ModelPill model={trade.model} />
      </td>

      {/* Direction */}
      <td style={{ padding: "10px 8px", width: 60 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: trade.direction === "Buy" ? "#10B981" : "#EF4444" }}>
          {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
        </span>
      </td>

      {/* Planned Entry */}
      <td style={{ padding: "10px 8px", width: 100 }}>
        <span style={{ fontSize: 12, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>
          {trade.planned_entry}
        </span>
      </td>

      {/* Current Price */}
      <td style={{ padding: "10px 8px", width: 100 }}>
        <span style={{ fontSize: 12, color: priceColor, fontVariantNumeric: "tabular-nums" }}>
          {trade.current_market_price}
        </span>
      </td>

      {/* Distance */}
      <td style={{ padding: "10px 8px", width: 120 }}>
        <DistanceBadge trade={trade} />
      </td>

      {/* R:R */}
      <td style={{ padding: "10px 8px", width: 80 }}>
        <span style={{ fontSize: 12, color: rr >= 2 ? "#10B981" : "#94A3B8", fontWeight: 600 }}>
          {rr.toFixed(2)}R
        </span>
      </td>

      {/* Risk */}
      <td style={{ padding: "10px 8px", width: 60 }}>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>{trade.planned_risk_pct}%</span>
      </td>

      {/* Conviction */}
      <td style={{ padding: "10px 8px", width: 90 }}>
        <ConvictionPill conviction={trade.conviction} />
      </td>

      {/* Actions */}
      <td
        style={{ padding: "10px 8px", width: 130 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {canConvert && (
            <button
              onClick={e => { e.stopPropagation(); onConvert(); }}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              Convert →
            </button>
          )}
          <MoreMenu
            trade={trade}
            onEdit={onEdit}
            onInvalidate={onInvalidate}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Status section ────────────────────────────────────────────────────────────
function StatusSection({
  status,
  trades,
  defaultCollapsed,
  onRowClick,
  onConvert,
  onInvalidate,
  onCancel,
  onDelete,
  onEdit,
}: {
  status: PlannedStatus;
  trades: PlannedTrade[];
  defaultCollapsed?: boolean;
  onRowClick: (t: PlannedTrade) => void;
  onConvert: (t: PlannedTrade) => void;
  onInvalidate: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (t: PlannedTrade) => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const cfg = STATUS_STYLE[status];

  if (trades.length === 0 && status !== "Ready") return null;

  return (
    <div>
      {/* Section heading */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 mb-2"
        style={{ paddingBottom: 6 }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.08)" }} />
        <span
          style={{
            fontSize: 11,
            color: cfg.color,
            opacity: 0.8,
            fontWeight: 600,
          }}
        >
          {trades.length}
        </span>
        <span style={{ color: "#475569" }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {!collapsed && (
        <>
          {trades.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-lg mb-4"
              style={{
                height: 52,
                border: "1px dashed rgba(148,163,184,0.1)",
                color: "#334155",
                fontSize: 12,
              }}
            >
              No {status.toLowerCase()} setups
            </div>
          ) : (
            <div className="rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.08)" }}>
              <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ background: "rgba(20,28,40,0.5)", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                    <th style={{ width: 4, padding: 0 }} />
                    {["Pair", "Model", "Dir", "Entry", "Current", "Distance", "R:R", "Risk", "Conviction", ""].map(h => (
                      <th
                        key={h}
                        className="text-left"
                        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#475569", padding: "8px 8px", textTransform: "uppercase" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(trade => (
                    <PlannedRow
                      key={trade.id}
                      trade={trade}
                      statusColor={cfg.barColor}
                      onRowClick={() => onRowClick(trade)}
                      onConvert={() => onConvert(trade)}
                      onInvalidate={() => onInvalidate(trade.id)}
                      onCancel={() => onCancel(trade.id)}
                      onDelete={() => onDelete(trade.id)}
                      onEdit={() => onEdit(trade)}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlannedPage() {
  const plannedQuery = usePlanned();
  const updatePlannedM = useUpdatePlanned();
  const deletePlannedM = useDeletePlanned();

  const trades = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);

  const [statusFilter, setStatusFilter] = useState<PlannedStatus | "All">("All");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const drawerTrade = trades.find(t => t.id === drawerId) ?? null;
  const convertTrade = trades.find(t => t.id === convertId) ?? null;
  const editTrade = trades.find(t => t.id === editId) ?? null;

  const filteredTrades = useMemo(() =>
    statusFilter === "All" ? trades : trades.filter(t => t.status === statusFilter),
    [trades, statusFilter]
  );

  const grouped = useMemo(() => {
    const map: Record<PlannedStatus, PlannedTrade[]> = {
      Ready: [], Watching: [], Invalidated: [], Cancelled: [],
    };
    for (const t of filteredTrades) map[t.status].push(t);
    return map;
  }, [filteredTrades]);

  const activeCount = trades.filter(t => t.status === "Watching" || t.status === "Ready").length;
  const invalidatedCount = trades.filter(t => t.status === "Invalidated").length;

  function updateStatus(id: string, status: PlannedStatus) {
    updatePlannedM.mutate({ id, body: { status } });
  }

  function handleDelete(id: string) {
    deletePlannedM.mutate(id);
    if (drawerId === id) setDrawerId(null);
  }

  function handleConvert(trade: PlannedTrade) {
    setConvertId(trade.id);
    setDrawerId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6 py-4 sm:py-6 max-w-full">

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#E2E8F0" }}>Planned Trades</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Setups in waiting. Setups in motion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, color: "#64748B" }}>
            <span style={{ color: "#93C5FD", fontWeight: 600 }}>{activeCount} active</span>
            {" · "}
            <span>{invalidatedCount} invalidated</span>
          </span>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(opt => {
            const active = statusFilter === opt;
            const isStatus = opt !== "All";
            const cfg = isStatus ? STATUS_STYLE[opt as PlannedStatus] : null;
            return (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt as PlannedStatus | "All")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: active
                    ? isStatus
                      ? `${cfg!.barColor}26`
                      : "rgba(59,130,246,0.15)"
                    : "rgba(20,28,40,0.6)",
                  color: active
                    ? isStatus ? cfg!.color : "#93C5FD"
                    : "#64748B",
                  border: active
                    ? `1px solid ${isStatus ? cfg!.barColor + "40" : "rgba(59,130,246,0.25)"}`
                    : "1px solid rgba(148,163,184,0.1)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "rgba(59,130,246,0.9)", color: "#fff" }}
        >
          <Plus size={14} />
          Add Planned Trade
        </button>
      </div>

      {/* Loading / error */}
      {plannedQuery.isLoading && <LoadingState message="Loading planned trades…" />}
      {plannedQuery.isError && (
        <ErrorState error={plannedQuery.error} onRetry={() => plannedQuery.refetch()} title="Couldn't load planned trades" />
      )}

      {/* Empty state */}
      {!plannedQuery.isLoading && !plannedQuery.isError && trades.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl"
          style={{
            minHeight: 240,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.08)",
          }}
        >
          <span style={{ fontSize: 32 }}>📋</span>
          <p style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>
            No setups being watched.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "rgba(59,130,246,0.9)", color: "#fff" }}
          >
            + Add Planned Trade
          </button>
        </div>
      )}

      {/* Status sections */}
      {trades.length > 0 && (
        <div className="flex flex-col gap-2">
          {STATUS_ORDER.map(status => (
            <StatusSection
              key={status}
              status={status}
              trades={grouped[status]}
              defaultCollapsed={status === "Cancelled"}
              onRowClick={t => setDrawerId(t.id)}
              onConvert={handleConvert}
              onInvalidate={id => updateStatus(id, "Invalidated")}
              onCancel={id => updateStatus(id, "Cancelled")}
              onDelete={handleDelete}
              onEdit={t => { setEditId(t.id); setShowAddModal(true); }}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        open={!!drawerTrade}
        onClose={() => setDrawerId(null)}
        title={drawerTrade
          ? `${pairs.find(p => p.symbol === drawerTrade.pair)?.display_name ?? drawerTrade.pair} · ${drawerTrade.model}`
          : ""}
      >
        {drawerTrade && (
          <PlannedDrawerContent
            trade={drawerTrade}
            onConvert={handleConvert}
            onMarkInvalidated={t => updateStatus(t.id, "Invalidated")}
          />
        )}
      </DetailDrawer>

      {/* Add / Edit planned trade modal */}
      <AddPlannedTradeModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditId(null); }}
        editId={editId ?? undefined}
        prefill={editTrade ?? undefined}
      />

      {/* Convert to live trade — opens AddTradeModal pre-filled */}
      {convertTrade && (
        <AddTradeModal
          open={!!convertTrade}
          prefill={{
            pair: convertTrade.pair,
            model: convertTrade.model,
            direction: convertTrade.direction,
            entry_price: convertTrade.planned_entry,
            sl_price: convertTrade.planned_sl,
            first_tp_price: convertTrade.planned_first_tp,
            main_tp_price: convertTrade.planned_main_tp,
            risk_pct: convertTrade.planned_risk_pct,
            conviction: convertTrade.conviction,
          }}
          onSubmitted={() =>
            updatePlannedM.mutate({
              id: convertTrade.id,
              body: {
                status: "Cancelled",
                notes: (convertTrade.notes ? convertTrade.notes + "\n" : "") + "[Converted to Live Trade]",
              },
            })
          }
          onClose={() => setConvertId(null)}
        />
      )}
    </div>
  );
}
