"use client";

import { useState } from "react";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, X,
} from "lucide-react";
import {
  formatCurrency, formatDate,
  type Model, type PairConfig, type Session,
} from "@/lib/demo-data";
import {
  edgeModelStats, edgePairStats, edgeSessionStats, edgeTotalClosedIdeaCount,
} from "@/lib/stats";
import { getPrimaryExecution, isExecutionOpen } from "@/lib/trade-helpers";
import {
  useTrades, useTradingModels, useTradingPairs,
  useCreateModel, useUpdateModel, useDeleteModel,
  useCreatePair, useUpdatePair, useDeletePair,
} from "@/hooks/useTrading";
import type { ApiPair } from "@/lib/api/trading";
import { SkeletonCard } from "@/components/state/Skeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/toast";

// ─── Design helpers ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "var(--lucid-surface)",
  border: "1px solid var(--lucid-line)",
  borderRadius: 12,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--lucid-surface-2)",
  border: "1px solid var(--lucid-line)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--lucid-ink)",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "var(--lucid-ink-3)",
  marginBottom: 6,
  display: "block",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase font-semibold"
      style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--lucid-ink-3)" }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="lt-serif text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)", letterSpacing: "0.08em" }}>
      {children}
    </p>
  );
}

function StatusPill({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span
      style={
        status === "Active"
          ? { background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "1px solid var(--lucid-pos-bd)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center" }
          : { background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line-2)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center" }
      }
    >
      {status}
    </span>
  );
}

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    Breakout: { bg: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Short: { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center" }}>
      {model}
    </span>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ fontSize: 11, color: "var(--lucid-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span className="lt-num" style={{ fontSize: 15, fontWeight: 600, color: color ?? "var(--lucid-ink)" }}>{value}</span>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
      <span style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--lucid-ink)" }}>{value}</span>
    </div>
  );
}

function formatWR(wr: number | null) {
  if (wr === null) return "—";
  return `${(wr * 100).toFixed(1)}%`;
}
function formatRR(rr: number | null) {
  if (rr === null) return "—";
  return `${rr.toFixed(2)}R`;
}
// Expectancy is now in R, not dollars — R is comparable across accounts of
// different sizes; dollar expectancy summed across a 10k challenge and a
// 100k funded account describes nothing.
function formatExp(exp: number | null) {
  if (exp === null) return "—";
  return `${exp.toFixed(2)}R`;
}
function wrColor(wr: number | null) {
  if (wr === null) return "var(--lucid-ink-3)";
  return wr > 0.4 ? "var(--lucid-pos)" : wr < 0.35 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
}

// ─── Model Modal ─────────────────────────────────────────────────────────────

interface ModelModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Model>;
  onSave: (data: Omit<Model, "id">) => void;
}

function ModelModal({ open, onClose, initial, onSave }: ModelModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive">(initial?.status ?? "Active");

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name, description, rules, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col gap-5 p-4 sm:p-6 w-full" style={{ ...CARD, maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <h2 className="lt-serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--lucid-ink)" }}>
            {initial?.name ? "Edit Model" : "Add Model"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--lucid-ink-3)", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <FieldGroup label="Name">
          <input style={INPUT_STYLE} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 4HPullBack" />
        </FieldGroup>

        <FieldGroup label="Description (max 100 chars)">
          <input style={INPUT_STYLE} value={description} maxLength={100}
            onChange={(e) => setDescription(e.target.value)} placeholder="Short description of the model" />
          <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginTop: 4 }}>{description.length}/100</p>
        </FieldGroup>

        <FieldGroup label="Rules">
          <textarea
            style={{ ...INPUT_STYLE, minHeight: 140, resize: "vertical" as const }}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Entry conditions, filters, EMA rules..."
          />
        </FieldGroup>

        <FieldGroup label="Status">
          <div className="flex gap-2">
            {(["Active", "Inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: "1px solid",
                  borderColor: status === s ? "var(--lucid-accent)" : "var(--lucid-line-2)",
                  background: status === s ? "var(--lucid-accent-bg)" : "transparent",
                  color: status === s ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>

        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--lucid-line)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "var(--lucid-ink-3)", background: "transparent", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "var(--lucid-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            {initial?.name ? "Save Changes" : "Add Model"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pair Modal ───────────────────────────────────────────────────────────────

interface PairModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<PairConfig>;
  onSave: (data: PairConfig) => void;
}

function PairModal({ open, onClose, initial, onSave }: PairModalProps) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [flagA, setFlagA] = useState(initial?.flag_a ?? "");
  const [flagB, setFlagB] = useState(initial?.flag_b ?? "");
  const [pipValue, setPipValue] = useState(String(initial?.pip_value ?? ""));
  const [status, setStatus] = useState<"Active" | "Inactive">(initial?.status ?? "Active");

  if (!open) return null;

  const handleSave = () => {
    if (!symbol.trim()) return;
    onSave({ symbol, display_name: displayName, flag_a: flagA, flag_b: flagB, pip_value: Number(pipValue), status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col gap-5 p-4 sm:p-6 w-full" style={{ ...CARD, maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <h2 className="lt-serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--lucid-ink)" }}>
            {initial?.symbol ? "Edit Pair" : "Add Pair"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--lucid-ink-3)", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="Symbol">
            <input style={INPUT_STYLE} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="EURUSD" />
          </FieldGroup>
          <FieldGroup label="Display Name">
            <input style={INPUT_STYLE} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="EUR/USD" />
          </FieldGroup>
          <FieldGroup label="Flag A (emoji)">
            <input style={INPUT_STYLE} value={flagA} onChange={(e) => setFlagA(e.target.value)} placeholder="🇪🇺" />
          </FieldGroup>
          <FieldGroup label="Flag B (emoji)">
            <input style={INPUT_STYLE} value={flagB} onChange={(e) => setFlagB(e.target.value)} placeholder="🇺🇸" />
          </FieldGroup>
        </div>

        <FieldGroup label="Pip Value">
          <input style={INPUT_STYLE} type="number" value={pipValue} onChange={(e) => setPipValue(e.target.value)} placeholder="10" />
        </FieldGroup>

        <FieldGroup label="Status">
          <div className="flex gap-2">
            {(["Active", "Inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: "1px solid",
                  borderColor: status === s ? "var(--lucid-accent)" : "var(--lucid-line-2)",
                  background: status === s ? "var(--lucid-accent-bg)" : "transparent",
                  color: status === s ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>

        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--lucid-line)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "var(--lucid-ink-3)", background: "transparent", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "var(--lucid-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            {initial?.symbol ? "Save Changes" : "Add Pair"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer Content ───────────────────────────────────────────────────────────

function ModelDrawerContent({ model, onEdit, onDelete }: { model: Model; onEdit: () => void; onDelete: () => void }) {
  const trades = useTrades().data ?? [];
  const stats = edgeModelStats(trades, model.name);
  const modelTrades = trades.filter((t) => t.model === model.name && !isExecutionOpen(getPrimaryExecution(t)!));

  return (
    <div className="flex flex-col gap-5 p-6" style={{ overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <span className="lt-serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--lucid-ink)" }}>{model.name}</span>
          <StatusPill status={model.status} />
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} style={{ color: "var(--lucid-ink-3)", background: "none", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>
          <button onClick={onDelete} style={{ color: "var(--lucid-neg)", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>{model.description}</div>

      {/* Rules */}
      <div>
        <SectionTitle>Rules</SectionTitle>
        <div
          style={{
            fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.8,
            background: "var(--lucid-surface)", borderRadius: 8, padding: "12px 14px",
            border: "1px solid var(--lucid-line)",
            whiteSpace: "pre-line",
          }}
        >
          {model.rules}
        </div>
      </div>

      {/* Performance stats 2×3 grid */}
      <div>
        <SectionTitle>Performance</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Win Rate", value: formatWR(stats.win_rate), color: wrColor(stats.win_rate) },
            { label: "Avg RR", value: formatRR(stats.avg_rr), color: "var(--lucid-ink)" },
            { label: "Total Trades", value: stats.idea_count > 0 ? String(stats.idea_count) : "—", color: "var(--lucid-ink)" },
            { label: "Net P&L", value: stats.idea_count > 0 ? formatCurrency(stats.net_pnl) : "—", color: stats.net_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" },
            { label: "Expectancy", value: formatExp(stats.expectancy_r), color: "var(--lucid-ink)" },
            { label: "Best Pair", value: stats.best_pair ?? "—", color: "var(--lucid-ink)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...CARD, padding: "12px 14px" }}>
              <span style={{ fontSize: 11, color: "var(--lucid-ink-3)", display: "block", marginBottom: 4 }}>{label}</span>
              <span className="lt-num" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Linked trades */}
      <div>
        <SectionTitle>Linked Trades</SectionTitle>
        {modelTrades.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {modelTrades.slice(0, 10).map((t) => {
              const p = getPrimaryExecution(t)!;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{formatDate(p.date_closed)}</span>
                    <span style={{ fontSize: 13, color: "var(--lucid-ink)" }}>{t.pair}</span>
                    <span style={{ fontSize: 12, color: t.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                      {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                    </span>
                  </div>
                  <span className="lt-num" style={{ fontSize: 13, fontWeight: 600, color: p.blended_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                    {formatCurrency(p.blended_pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PairDrawerContent({ pair, onEdit, onDelete }: { pair: PairConfig; onEdit: () => void; onDelete: () => void }) {
  const trades = useTrades().data ?? [];
  const stats = edgePairStats(trades, pair.symbol);
  const pairTrades = trades.filter((t) => t.pair === pair.symbol && !isExecutionOpen(getPrimaryExecution(t)!));

  return (
    <div className="flex flex-col gap-5 p-6" style={{ overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24 }}>{pair.flag_a}{pair.flag_b}</span>
            <span className="lt-serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--lucid-ink)" }}>{pair.display_name}</span>
          </div>
          <StatusPill status={pair.status} />
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} style={{ color: "var(--lucid-ink-3)", background: "none", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>
          <button onClick={onDelete} style={{ color: "var(--lucid-neg)", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Performance stats */}
      <div>
        <SectionTitle>Performance</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Win Rate", value: formatWR(stats.win_rate), color: wrColor(stats.win_rate) },
            { label: "Trade Count", value: stats.idea_count > 0 ? String(stats.idea_count) : "—", color: "var(--lucid-ink)" },
            { label: "Net P&L", value: stats.idea_count > 0 ? formatCurrency(stats.net_pnl) : "—", color: stats.net_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...CARD, padding: "12px 14px" }}>
              <span style={{ fontSize: 11, color: "var(--lucid-ink-3)", display: "block", marginBottom: 4 }}>{label}</span>
              <span className="lt-num" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best / Worst Model */}
      <div>
        <SectionTitle>Model Performance on {pair.display_name}</SectionTitle>
        <div className="flex flex-col">
          {kv("Best Model", stats.best_model ? <ModelPill model={stats.best_model} /> : "—")}
          {kv("Worst Model", stats.worst_model && stats.worst_model !== stats.best_model ? <ModelPill model={stats.worst_model} /> : "—")}
        </div>
      </div>

      {/* All trades on this pair */}
      <div>
        <SectionTitle>All Trades</SectionTitle>
        {pairTrades.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1" style={{ maxHeight: 300, overflowY: "auto" }}>
            {pairTrades.map((t) => {
              const p = getPrimaryExecution(t)!;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{formatDate(p.date_closed)}</span>
                    <ModelPill model={t.model} />
                    <span style={{ fontSize: 12, color: t.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                      {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                    </span>
                  </div>
                  <span className="lt-num" style={{ fontSize: 13, fontWeight: 600, color: p.blended_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                    {formatCurrency(p.blended_pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Models Tab ───────────────────────────────────────────────────────────────

function ModelCard({ model, onClick }: { model: Model; onClick: () => void }) {
  const [showRules, setShowRules] = useState(false);
  const trades = useTrades().data ?? [];
  const stats = edgeModelStats(trades, model.name);

  return (
    <div
      className="cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-rules-btn]")) return;
        onClick();
      }}
      style={{
        ...CARD,
        padding: "20px 24px",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--lucid-line-3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--lucid-line)";
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="lt-serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--lucid-ink)" }}>{model.name}</span>
        <StatusPill status={model.status} />
      </div>

      <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", marginBottom: 16, lineHeight: 1.5 }}>{model.description}</p>

      <div style={{ borderTop: "1px solid var(--lucid-line)", paddingTop: 16, marginBottom: 16 }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="flex flex-wrap items-center gap-5 sm:gap-8 mt-3">
          <StatCell label="WR" value={formatWR(stats.win_rate)} color={wrColor(stats.win_rate)} />
          <StatCell label="RR" value={formatRR(stats.avg_rr)} />
          <StatCell label="Trades" value={stats.idea_count > 0 ? String(stats.idea_count) : "—"} />
          <StatCell label="Expectancy" value={formatExp(stats.expectancy_r)} />
        </div>
      </div>

      <button
        data-rules-btn=""
        onClick={(e) => {
          e.stopPropagation();
          setShowRules((v) => !v);
        }}
        className="flex items-center gap-1"
        style={{ fontSize: 12, color: "var(--lucid-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {showRules ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showRules ? "Hide Rules" : "Show Rules"}
      </button>

      {showRules && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.8,
            background: "var(--lucid-surface-2)", borderRadius: 8, padding: "12px 14px",
            border: "1px solid var(--lucid-line)",
            whiteSpace: "pre-line",
          }}
        >
          {model.rules}
        </div>
      )}
    </div>
  );
}

function ModelsTab() {
  const modelsQuery = useTradingModels();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();

  const modelList = modelsQuery.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Model | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Model | null>(null);

  const drawerModel = modelList.find((m) => m.id === drawerId) ?? null;

  const handleSave = (data: Omit<Model, "id">) => {
    if (editTarget) {
      updateModel.mutate({ id: editTarget.id, body: data }, {
        onSuccess: () => toast.success(`${data.name} updated.`, { title: "Model saved" }),
      });
    } else {
      createModel.mutate(data, {
        onSuccess: () => toast.success(`${data.name} added to your models.`, { title: "Model added" }),
      });
    }
    setEditTarget(null);
    setModalOpen(false);
  };

  const confirmDelete = () => {
    const model = pendingDelete;
    if (!model) return;
    deleteModel.mutate(model.id, {
      onSuccess: () => { toast.success(`${model.name} deleted.`, { title: "Model deleted" }); setDrawerId(null); },
      onSettled: () => setPendingDelete(null),
    });
  };

  const openEdit = (model: Model) => {
    setEditTarget(model);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2"
          style={{ background: "var(--lucid-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> Add Model
        </button>
      </div>

      {modelsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} height={124} />
          ))}
        </div>
      ) : modelsQuery.isError ? (
        <ErrorState error={modelsQuery.error} onRetry={() => modelsQuery.refetch()} title="Couldn't load models" />
      ) : (
        <div className="flex flex-col gap-4">
          {modelList.map((model) => (
            <ModelCard key={model.id} model={model} onClick={() => setDrawerId(model.id)} />
          ))}
        </div>
      )}

      <ModelModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleSave}
      />

      <DetailDrawer open={!!drawerModel} onClose={() => setDrawerId(null)} title={drawerModel?.name ?? ""}>
        {drawerModel && (
          <ModelDrawerContent
            model={drawerModel}
            onEdit={() => openEdit(drawerModel)}
            onDelete={() => setPendingDelete(drawerModel)}
          />
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete model?"
        message={pendingDelete ? `"${pendingDelete.name}" will be removed. Trades already logged with this model keep their saved model name.` : undefined}
        confirmLabel="Delete"
        loading={deleteModel.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

// ─── Pairs Tab ────────────────────────────────────────────────────────────────

function PairCard({ pair, onClick }: { pair: PairConfig; onClick: () => void }) {
  const trades = useTrades().data ?? [];
  const stats = edgePairStats(trades, pair.symbol);
  const recentTrades = trades
    .filter((t) => t.pair === pair.symbol && !isExecutionOpen(getPrimaryExecution(t)!))
    .sort((a, b) => new Date(getPrimaryExecution(b)!.date_closed).getTime() - new Date(getPrimaryExecution(a)!.date_closed).getTime())
    .slice(0, 3);

  return (
    <div
      className="cursor-pointer"
      onClick={onClick}
      style={{
        ...CARD,
        padding: "20px 20px",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--lucid-line-3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--lucid-line)";
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{pair.flag_a} {pair.flag_b}</div>

      <div className="flex items-center justify-between mb-4">
        <span className="lt-serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--lucid-ink)" }}>{pair.display_name}</span>
        <StatusPill status={pair.status} />
      </div>

      <div style={{ borderTop: "1px solid var(--lucid-line)", paddingTop: 12, marginBottom: 12 }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-2">
          <StatCell label="Trades" value={stats.idea_count > 0 ? String(stats.idea_count) : "—"} />
          <StatCell label="WR" value={formatWR(stats.win_rate)} color={wrColor(stats.win_rate)} />
          <StatCell
            label="Net P&L"
            value={stats.idea_count > 0 ? formatCurrency(stats.net_pnl) : "—"}
            color={stats.net_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)"}
          />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--lucid-line)", paddingTop: 12 }}>
        <SectionLabel>Recent</SectionLabel>
        {recentTrades.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginTop: 6 }}>No trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1 mt-2">
            {recentTrades.map((t) => {
              const p = getPrimaryExecution(t)!;
              return (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{formatDate(p.date_closed).replace(", 2026", "")}</span>
                    <span style={{ fontSize: 11, color: t.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                      {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="lt-num" style={{ fontSize: 12, fontWeight: 600, color: p.blended_pnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                      {p.blended_pnl > 0 ? "+" : ""}{formatCurrency(p.blended_pnl)}
                    </span>
                    <span style={{ fontSize: 12, color: p.blended_pnl > 0 ? "var(--lucid-pos)" : p.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)" }}>
                      {p.blended_pnl > 0 ? "✓" : p.blended_pnl < 0 ? "✗" : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PairsTab() {
  const pairsQuery = useTradingPairs();
  const createPair = useCreatePair();
  const updatePair = useUpdatePair();
  const deletePair = useDeletePair();

  const pairList = pairsQuery.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiPair | null>(null);
  const [drawerSymbol, setDrawerSymbol] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiPair | null>(null);

  const drawerPair = pairList.find((p) => p.symbol === drawerSymbol) ?? null;

  const confirmDelete = () => {
    const p = pendingDelete;
    if (!p) return;
    deletePair.mutate(p.id, {
      onSuccess: () => { toast.success(`${p.display_name || p.symbol} deleted.`, { title: "Pair deleted" }); setDrawerSymbol(null); },
      onSettled: () => setPendingDelete(null),
    });
  };

  const handleSave = (data: PairConfig) => {
    const body = {
      symbol: data.symbol,
      display_name: data.display_name,
      flag_a: data.flag_a,
      flag_b: data.flag_b,
      pip_value: data.pip_value,
      status: data.status,
    };
    if (editTarget) {
      updatePair.mutate({ id: editTarget.id, body }, {
        onSuccess: () => toast.success(`${data.display_name || data.symbol} updated.`, { title: "Pair saved" }),
      });
    } else {
      createPair.mutate(body, {
        onSuccess: () => toast.success(`${data.display_name || data.symbol} added to your pairs.`, { title: "Pair added" }),
      });
    }
    setEditTarget(null);
    setModalOpen(false);
  };

  const openEdit = (pair: ApiPair) => {
    setEditTarget(pair);
    setDrawerSymbol(null);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2"
          style={{ background: "var(--lucid-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> Add Pair
        </button>
      </div>

      {pairsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={156} />
          ))}
        </div>
      ) : pairsQuery.isError ? (
        <ErrorState error={pairsQuery.error} onRetry={() => pairsQuery.refetch()} title="Couldn't load pairs" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pairList.map((pair) => (
            <PairCard key={pair.id} pair={pair} onClick={() => setDrawerSymbol(pair.symbol)} />
          ))}
        </div>
      )}

      <PairModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleSave}
      />

      <DetailDrawer open={!!drawerPair} onClose={() => setDrawerSymbol(null)} title={drawerPair?.display_name ?? ""}>
        {drawerPair && (
          <PairDrawerContent
            pair={drawerPair}
            onEdit={() => openEdit(drawerPair)}
            onDelete={() => setPendingDelete(drawerPair)}
          />
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete pair?"
        message={pendingDelete ? `"${pendingDelete.display_name || pendingDelete.symbol}" will be removed from your tradable pairs.` : undefined}
        confirmLabel="Delete"
        loading={deletePair.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

const SESSION_DEFINITIONS: { key: Session; emoji: string; label: string; time: string }[] = [
  { key: "Asian",             emoji: "🌅", label: "Asian Session",     time: "05:30 – 11:30 IST" },
  { key: "London",            emoji: "🏛️", label: "London Session",    time: "13:30 – 17:30 IST" },
  { key: "London-NY Overlap", emoji: "🌐", label: "London-NY Overlap", time: "17:30 – 21:30 IST" },
  { key: "New York",          emoji: "🗽", label: "New York Session",   time: "17:30 – 01:30 IST" },
];

function SessionCard({ session }: { session: typeof SESSION_DEFINITIONS[number] }) {
  const trades = useTrades().data ?? [];
  const stats = edgeSessionStats(trades, session.key);
  const totalIdeas = edgeTotalClosedIdeaCount(trades);
  const pct = totalIdeas > 0 ? stats.idea_count / totalIdeas : 0;
  const avgPnl = stats.idea_count > 0 ? stats.net_pnl / stats.idea_count : null;

  return (
    <div style={{ ...CARD, padding: "20px 20px" }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 20 }}>{session.emoji}</span>
        <span className="lt-serif" style={{ fontSize: 15, fontWeight: 700, color: "var(--lucid-ink)" }}>{session.label}</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginBottom: 16 }}>{session.time}</p>

      <div className="flex flex-col">
        {kv("Trade Count", <span className="lt-num" style={{ color: "var(--lucid-ink)", fontWeight: 600 }}>{stats.idea_count > 0 ? stats.idea_count : "—"}</span>)}
        {kv("Win Rate", <span className="lt-num" style={{ color: wrColor(stats.win_rate), fontWeight: 600 }}>{formatWR(stats.win_rate)}</span>)}
        {kv("Avg P&L", <span className="lt-num" style={{ color: avgPnl !== null && avgPnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)", fontWeight: 600 }}>
          {avgPnl !== null ? formatCurrency(avgPnl) : "—"}
        </span>)}
        {kv("Best Pair", <span style={{ color: "var(--lucid-ink)", fontWeight: 600 }}>{stats.best_pair ?? "—"}</span>)}
      </div>

      <div style={{ borderTop: "1px solid var(--lucid-line)", paddingTop: 12, marginTop: 8 }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>% of total trades</span>
          <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{stats.idea_count} trade{stats.idea_count !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "var(--lucid-surface-3)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(pct * 100).toFixed(1)}%`,
              borderRadius: 4,
              background: "var(--lucid-accent)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SessionsTab() {
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", marginBottom: 20, fontStyle: "italic" }}>
        Sessions are auto-tagged from trade entry time. No manual configuration required.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SESSION_DEFINITIONS.map((s) => (
          <SessionCard key={s.key} session={s} />
        ))}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "Models" | "Pairs" | "Sessions";

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Models");

  return (
    <div className="px-4 sm:px-8 py-5 sm:py-8 pb-12">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="lt-serif" style={{ fontSize: 24, fontWeight: 600, color: "var(--lucid-ink)", marginBottom: 4 }}>System</h1>
        <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>Building blocks. Performance. Configuration.</p>
      </div>

      {/* Sub-tab nav */}
      <div
        className="flex items-center gap-1 mb-8"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        {(["Models", "Pairs", "Sessions"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative h-10 px-4 text-sm font-medium"
              style={{
                color: active ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab}
              {active && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    borderRadius: "2px 2px 0 0",
                    background: "var(--lucid-accent)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "Models" && <ModelsTab />}
      {activeTab === "Pairs" && <PairsTab />}
      {activeTab === "Sessions" && <SessionsTab />}
    </div>
  );
}
