"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { pairs, getDistanceToEntry, type PlannedStatus } from "@/lib/demo-data";
import { usePlanned, useUpdatePlanned, useDeletePlanned } from "@/hooks/useTrading";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { LoadingState } from "@/components/state/LoadingState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ScreenshotGallery } from "@/components/ScreenshotUploader";
import { toast } from "@/components/toast";
import { AddPlannedTradeModal } from "../AddPlannedTradeModal";
import { AddTradeModal } from "../../journal/AddTradeModal";
import {
  calcRR,
  ModelPill,
  ConvictionPill,
  StatusPill,
  DistanceBadge,
} from "../PlannedDrawerContent";

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
      <span style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>{label}</span>
      <span className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lt-card rounded-xl p-4 sm:p-5" style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)", letterSpacing: "0.08em" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export default function PlannedDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const plannedQuery = usePlanned();
  const updatePlanned = useUpdatePlanned();
  const deletePlanned = useDeletePlanned();

  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trade = (plannedQuery.data ?? []).find((t) => t.id === id);

  if (plannedQuery.isLoading) {
    return (
      <DetailPageLayout backHref="/trading/planned" backLabel="Planned" title="Planned trade">
        <LoadingState message="Loading planned trade…" />
      </DetailPageLayout>
    );
  }

  if (!trade) {
    return (
      <DetailPageLayout backHref="/trading/planned" backLabel="Planned" title="Planned trade not found">
        <div className="py-16 text-center" style={{ color: "var(--lucid-ink-3)", fontSize: 14 }}>
          This planned trade could not be found. It may have been deleted or converted.
        </div>
      </DetailPageLayout>
    );
  }

  const config = pairs.find((p) => p.symbol === trade.pair);
  const rr = calcRR(trade);
  const dist = getDistanceToEntry(trade);
  const canConvert = trade.status === "Watching" || trade.status === "Ready";

  function updateStatus(status: PlannedStatus) {
    updatePlanned.mutate(
      { id, body: { status } },
      {
        onSuccess: () =>
          status === "Invalidated"
            ? toast.warning("Setup invalidated.", { title: "Setup invalidated" })
            : toast.info(`Setup marked as ${status.toLowerCase()}.`),
      },
    );
  }

  function handleDelete() {
    deletePlanned.mutate(id, {
      onSuccess: () => {
        toast.success("Planned trade deleted.");
        router.push("/trading/planned");
      },
      onSettled: () => setConfirmDelete(false),
    });
  }

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
      backHref="/trading/planned"
      backLabel="Planned"
      title={`${config?.display_name ?? trade.pair} · ${trade.model}`}
      actions={actions}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {config && <span style={{ fontSize: 22 }}>{config.flag_a}{config.flag_b}</span>}
        <h2 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>{config?.display_name ?? trade.pair}</h2>
        <ModelPill model={trade.model} />
        <span className="lt-num" style={{ fontSize: 14, fontWeight: 600, color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
          {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
        </span>
        <StatusPill status={trade.status} />
        <ConvictionPill conviction={trade.conviction} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Setup Levels">
          {kv("Planned Entry", trade.planned_entry)}
          {kv("Stop Loss", trade.planned_sl)}
          {trade.planned_first_tp != null && kv("First TP", trade.planned_first_tp)}
          {kv("Main TP", trade.planned_main_tp)}
          {kv("R:R Plan", <span style={{ color: rr >= 2 ? "var(--lucid-pos)" : "var(--lucid-ink)", fontWeight: 600 }}>{rr.toFixed(2)}R</span>)}
          {kv("Planned Risk", `${trade.planned_risk_pct}%`)}
        </Card>

        <Card title="Distance to Entry">
          <div className="mb-3">
            <DistanceBadge trade={trade} large />
            <p className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginTop: 6 }}>
              Current {trade.current_market_price} · Planned {trade.planned_entry} · {dist.direction === "at" ? "at entry" : `${dist.pips} pips ${dist.direction}`}
            </p>
          </div>
          {kv("Added", new Date(trade.date_added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}
        </Card>
      </div>

      {trade.notes && (
        <div className="mt-5">
          <Card title="Notes">
            <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{trade.notes}</p>
          </Card>
        </div>
      )}

      <div className="mt-5">
        <Card title="Screenshots">
          <ScreenshotGallery urls={trade.screenshots} />
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        {canConvert && (
          <button
            onClick={() => setConvertOpen(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)" }}
          >
            Convert to Live Trade
          </button>
        )}
        {trade.status !== "Invalidated" && trade.status !== "Cancelled" && (
          <button
            onClick={() => updateStatus("Invalidated")}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}
          >
            Mark Invalidated
          </button>
        )}
      </div>

      {/* Edit modal */}
      <AddPlannedTradeModal open={editOpen} onClose={() => setEditOpen(false)} editId={trade.id} prefill={trade} />

      {/* Convert → live trade */}
      {convertOpen && (
        <AddTradeModal
          open={convertOpen}
          prefill={{
            pair: trade.pair,
            model: trade.model,
            direction: trade.direction,
            planned_entry: trade.planned_entry,
            planned_sl: trade.planned_sl,
            planned_first_tp: trade.planned_first_tp,
            planned_main_tp: trade.planned_main_tp,
            risk_pct: trade.planned_risk_pct,
            conviction: trade.conviction,
          }}
          onSubmitted={() =>
            updatePlanned.mutate({
              id: trade.id,
              body: { status: "Cancelled", notes: (trade.notes ? trade.notes + "\n" : "") + "[Converted to Live Trade]" },
            })
          }
          onClose={() => setConvertOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete planned trade?"
        message={`${config?.display_name ?? trade.pair} ${trade.direction} will be permanently removed from your watchlist.`}
        confirmLabel="Delete"
        loading={deletePlanned.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </DetailPageLayout>
  );
}
