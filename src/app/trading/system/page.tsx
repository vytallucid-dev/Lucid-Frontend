"use client";

import { useState } from "react";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, X,
} from "lucide-react";
import {
  models as allModels, pairs as allPairs, trades,
  formatCurrency, formatDate,
  type Model, type PairConfig, type ModelName, type Pair, type Session,
} from "@/lib/demo-data";
import {
  getModelStats, getPairStats, getSessionStats, getTotalClosedTradeCount,
} from "@/lib/stats";
import { DetailDrawer } from "@/components/DetailDrawer";

// ─── Design helpers ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(20,28,40,0.6)",
  border: "1px solid rgba(148,163,184,0.1)",
  borderRadius: 12,
  backdropFilter: "blur(12px)",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(20,28,40,0.8)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#E2E8F0",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "#64748B",
  marginBottom: 6,
  display: "block",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase font-semibold"
      style={{ fontSize: 10, letterSpacing: "0.08em", color: "#64748B" }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B", letterSpacing: "0.08em" }}>
      {children}
    </p>
  );
}

function StatusPill({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span
      style={
        status === "Active"
          ? { background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center" }
          : { background: "rgba(148,163,184,0.1)", color: "#64748B", border: "1px solid rgba(148,163,184,0.2)", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center" }
      }
    >
      {status}
    </span>
  );
}

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.2)" },
    Breakout: { bg: "rgba(168,85,247,0.12)", color: "#C084FC", border: "rgba(168,85,247,0.2)" },
    Short: { bg: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
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
      <span style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color ?? "#E2E8F0" }}>{value}</span>
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
    <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#E2E8F0" }}>{value}</span>
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
function formatExp(exp: number | null) {
  if (exp === null) return "—";
  return formatCurrency(exp);
}
function wrColor(wr: number | null) {
  if (wr === null) return "#64748B";
  return wr > 0.4 ? "#10B981" : wr < 0.35 ? "#EF4444" : "#94A3B8";
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
    onSave({ name: name as ModelName, description, rules, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col gap-5 p-4 sm:p-6 w-full" style={{ ...CARD, maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#E2E8F0" }}>
            {initial?.name ? "Edit Model" : "Add Model"}
          </h2>
          <button onClick={onClose} style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <FieldGroup label="Name">
          <input style={INPUT_STYLE} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 4HPullBack" />
        </FieldGroup>

        <FieldGroup label="Description (max 100 chars)">
          <input style={INPUT_STYLE} value={description} maxLength={100}
            onChange={(e) => setDescription(e.target.value)} placeholder="Short description of the model" />
          <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{description.length}/100</p>
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
                  borderColor: status === s ? "#3B82F6" : "rgba(148,163,184,0.15)",
                  background: status === s ? "rgba(59,130,246,0.15)" : "transparent",
                  color: status === s ? "#93C5FD" : "#64748B",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>

        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "#64748B", background: "transparent", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
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
    onSave({ symbol: symbol as Pair, display_name: displayName, flag_a: flagA, flag_b: flagB, pip_value: Number(pipValue), status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col gap-5 p-4 sm:p-6 w-full" style={{ ...CARD, maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#E2E8F0" }}>
            {initial?.symbol ? "Edit Pair" : "Add Pair"}
          </h2>
          <button onClick={onClose} style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
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
                  borderColor: status === s ? "#3B82F6" : "rgba(148,163,184,0.15)",
                  background: status === s ? "rgba(59,130,246,0.15)" : "transparent",
                  color: status === s ? "#93C5FD" : "#64748B",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>

        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "#64748B", background: "transparent", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
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
  const stats = getModelStats(model.name);
  const modelTrades = trades.filter((t) => t.model === model.name && t.date_closed !== "");

  return (
    <div className="flex flex-col gap-5 p-6" style={{ overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <span style={{ fontSize: 18, fontWeight: 700, color: "#E2E8F0" }}>{model.name}</span>
          <StatusPill status={model.status} />
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>
          <button onClick={onDelete} style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{model.description}</div>

      {/* Rules */}
      <div>
        <SectionTitle>Rules</SectionTitle>
        <div
          style={{
            fontSize: 13, color: "#94A3B8", lineHeight: 1.8,
            background: "rgba(20,28,40,0.6)", borderRadius: 8, padding: "12px 14px",
            border: "1px solid rgba(148,163,184,0.08)",
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
            { label: "Win Rate", value: formatWR(stats.wr), color: wrColor(stats.wr) },
            { label: "Avg RR", value: formatRR(stats.rr), color: "#E2E8F0" },
            { label: "Total Trades", value: stats.trade_count > 0 ? String(stats.trade_count) : "—", color: "#E2E8F0" },
            { label: "Net P&L", value: stats.trade_count > 0 ? formatCurrency(stats.net_pnl) : "—", color: stats.net_pnl >= 0 ? "#10B981" : "#EF4444" },
            { label: "Expectancy", value: formatExp(stats.expectancy), color: "#E2E8F0" },
            { label: "Best Pair", value: stats.best_pair ?? "—", color: "#E2E8F0" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...CARD, padding: "12px 14px" }}>
              <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 4 }}>{label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Linked trades */}
      <div>
        <SectionTitle>Linked Trades</SectionTitle>
        {modelTrades.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748B" }}>No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {modelTrades.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "rgba(20,28,40,0.5)", border: "1px solid rgba(148,163,184,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 12, color: "#64748B" }}>{formatDate(t.date_closed)}</span>
                  <span style={{ fontSize: 13, color: "#E2E8F0" }}>{t.pair}</span>
                  <span style={{ fontSize: 12, color: t.direction === "Buy" ? "#10B981" : "#EF4444" }}>
                    {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.blended_pnl >= 0 ? "#10B981" : "#EF4444" }}>
                  {formatCurrency(t.blended_pnl)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PairDrawerContent({ pair, onEdit }: { pair: PairConfig; onEdit: () => void }) {
  const stats = getPairStats(pair.symbol);
  const pairTrades = trades.filter((t) => t.pair === pair.symbol && t.date_closed !== "");

  return (
    <div className="flex flex-col gap-5 p-6" style={{ overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24 }}>{pair.flag_a}{pair.flag_b}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#E2E8F0" }}>{pair.display_name}</span>
          </div>
          <StatusPill status={pair.status} />
        </div>
        <button onClick={onEdit} style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>
      </div>

      {/* Performance stats */}
      <div>
        <SectionTitle>Performance</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Win Rate", value: formatWR(stats.wr), color: wrColor(stats.wr) },
            { label: "Trade Count", value: stats.trade_count > 0 ? String(stats.trade_count) : "—", color: "#E2E8F0" },
            { label: "Net P&L", value: stats.trade_count > 0 ? formatCurrency(stats.net_pnl) : "—", color: stats.net_pnl >= 0 ? "#10B981" : "#EF4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...CARD, padding: "12px 14px" }}>
              <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 4 }}>{label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
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
          <p style={{ fontSize: 13, color: "#64748B" }}>No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1" style={{ maxHeight: 300, overflowY: "auto" }}>
            {pairTrades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "rgba(20,28,40,0.5)", border: "1px solid rgba(148,163,184,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 12, color: "#64748B" }}>{formatDate(t.date_closed)}</span>
                  <ModelPill model={t.model} />
                  <span style={{ fontSize: 12, color: t.direction === "Buy" ? "#10B981" : "#EF4444" }}>
                    {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.blended_pnl >= 0 ? "#10B981" : "#EF4444" }}>
                  {formatCurrency(t.blended_pnl)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Models Tab ───────────────────────────────────────────────────────────────

function ModelCard({ model, onClick }: { model: Model; onClick: () => void }) {
  const [showRules, setShowRules] = useState(false);
  const stats = getModelStats(model.name);

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
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(59,130,246,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(148,163,184,0.1)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 17, fontWeight: 700, color: "#E2E8F0" }}>{model.name}</span>
        <StatusPill status={model.status} />
      </div>

      <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16, lineHeight: 1.5 }}>{model.description}</p>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)", paddingTop: 16, marginBottom: 16 }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="flex flex-wrap items-center gap-5 sm:gap-8 mt-3">
          <StatCell label="WR" value={formatWR(stats.wr)} color={wrColor(stats.wr)} />
          <StatCell label="RR" value={formatRR(stats.rr)} />
          <StatCell label="Trades" value={stats.trade_count > 0 ? String(stats.trade_count) : "—"} />
          <StatCell label="Expectancy" value={formatExp(stats.expectancy)} />
        </div>
      </div>

      <button
        data-rules-btn=""
        onClick={(e) => {
          e.stopPropagation();
          setShowRules((v) => !v);
        }}
        className="flex items-center gap-1"
        style={{ fontSize: 12, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {showRules ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showRules ? "Hide Rules" : "Show Rules"}
      </button>

      {showRules && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13, color: "#94A3B8", lineHeight: 1.8,
            background: "rgba(20,28,40,0.5)", borderRadius: 8, padding: "12px 14px",
            border: "1px solid rgba(148,163,184,0.08)",
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
  const [modelList, setModelList] = useState<Model[]>(allModels);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Model | null>(null);
  const [drawerModel, setDrawerModel] = useState<Model | null>(null);

  const handleSave = (data: Omit<Model, "id">) => {
    if (editTarget) {
      const updated = { ...editTarget, ...data };
      setModelList((prev) => prev.map((m) => (m.id === editTarget.id ? updated : m)));
      if (drawerModel?.id === editTarget.id) setDrawerModel(updated);
    } else {
      setModelList((prev) => [...prev, { id: `mdl_${Date.now()}`, ...data }]);
    }
    setEditTarget(null);
    setModalOpen(false);
  };

  const handleDelete = (model: Model) => {
    setModelList((prev) => prev.filter((m) => m.id !== model.id));
    setDrawerModel(null);
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
          style={{ background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> Add Model
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {modelList.map((model) => (
          <ModelCard key={model.id} model={model} onClick={() => setDrawerModel(model)} />
        ))}
      </div>

      <ModelModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleSave}
      />

      <DetailDrawer open={!!drawerModel} onClose={() => setDrawerModel(null)} title={drawerModel?.name ?? ""}>
        {drawerModel && (
          <ModelDrawerContent
            model={drawerModel}
            onEdit={() => openEdit(drawerModel)}
            onDelete={() => handleDelete(drawerModel)}
          />
        )}
      </DetailDrawer>
    </>
  );
}

// ─── Pairs Tab ────────────────────────────────────────────────────────────────

function PairCard({ pair, onClick }: { pair: PairConfig; onClick: () => void }) {
  const stats = getPairStats(pair.symbol);
  const recentTrades = trades
    .filter((t) => t.pair === pair.symbol && t.date_closed !== "")
    .sort((a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime())
    .slice(0, 3);

  return (
    <div
      className="cursor-pointer"
      onClick={onClick}
      style={{
        ...CARD,
        padding: "20px 20px",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(59,130,246,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(148,163,184,0.1)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{pair.flag_a} {pair.flag_b}</div>

      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: 17, fontWeight: 700, color: "#E2E8F0" }}>{pair.display_name}</span>
        <StatusPill status={pair.status} />
      </div>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)", paddingTop: 12, marginBottom: 12 }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-2">
          <StatCell label="Trades" value={stats.trade_count > 0 ? String(stats.trade_count) : "—"} />
          <StatCell label="WR" value={formatWR(stats.wr)} color={wrColor(stats.wr)} />
          <StatCell
            label="Net P&L"
            value={stats.trade_count > 0 ? formatCurrency(stats.net_pnl) : "—"}
            color={stats.net_pnl >= 0 ? "#10B981" : "#EF4444"}
          />
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)", paddingTop: 12 }}>
        <SectionLabel>Recent</SectionLabel>
        {recentTrades.length === 0 ? (
          <p style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>No trades yet.</p>
        ) : (
          <div className="flex flex-col gap-1 mt-2">
            {recentTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: "#64748B" }}>{formatDate(t.date_closed).replace(", 2026", "")}</span>
                  <span style={{ fontSize: 11, color: t.direction === "Buy" ? "#10B981" : "#EF4444" }}>
                    {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.blended_pnl >= 0 ? "#10B981" : "#EF4444" }}>
                    {t.blended_pnl > 0 ? "+" : ""}{formatCurrency(t.blended_pnl)}
                  </span>
                  <span style={{ fontSize: 12, color: t.blended_rr > 0 ? "#10B981" : t.blended_rr < 0 ? "#EF4444" : "#64748B" }}>
                    {t.blended_rr > 0 ? "✓" : t.blended_rr < 0 ? "✗" : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PairsTab() {
  const [pairList, setPairList] = useState<PairConfig[]>(allPairs);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PairConfig | null>(null);
  const [drawerPair, setDrawerPair] = useState<PairConfig | null>(null);

  const handleSave = (data: PairConfig) => {
    if (editTarget) {
      const updated = { ...editTarget, ...data };
      setPairList((prev) => prev.map((p) => (p.symbol === editTarget.symbol ? updated : p)));
      if (drawerPair?.symbol === editTarget.symbol) setDrawerPair(updated);
    } else {
      setPairList((prev) => [...prev, data]);
    }
    setEditTarget(null);
    setModalOpen(false);
  };

  const openEdit = (pair: PairConfig) => {
    setEditTarget(pair);
    setDrawerPair(null);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2"
          style={{ background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> Add Pair
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pairList.map((pair) => (
          <PairCard key={pair.symbol} pair={pair} onClick={() => setDrawerPair(pair)} />
        ))}
      </div>

      <PairModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleSave}
      />

      <DetailDrawer open={!!drawerPair} onClose={() => setDrawerPair(null)} title={drawerPair?.display_name ?? ""}>
        {drawerPair && (
          <PairDrawerContent pair={drawerPair} onEdit={() => openEdit(drawerPair)} />
        )}
      </DetailDrawer>
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
  const stats = getSessionStats(session.key);
  const totalTrades = getTotalClosedTradeCount();
  const pct = totalTrades > 0 ? stats.trade_count / totalTrades : 0;

  return (
    <div style={{ ...CARD, padding: "20px 20px" }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 20 }}>{session.emoji}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{session.label}</span>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>{session.time}</p>

      <div className="flex flex-col">
        {kv("Trade Count", <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{stats.trade_count > 0 ? stats.trade_count : "—"}</span>)}
        {kv("Win Rate", <span style={{ color: wrColor(stats.wr), fontWeight: 600 }}>{formatWR(stats.wr)}</span>)}
        {kv("Avg P&L", <span style={{ color: stats.avg_pnl !== null && stats.avg_pnl >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>
          {stats.avg_pnl !== null ? formatCurrency(stats.avg_pnl) : "—"}
        </span>)}
        {kv("Best Pair", <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{stats.best_pair ?? "—"}</span>)}
      </div>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)", paddingTop: 12, marginTop: 8 }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, color: "#64748B" }}>% of total trades</span>
          <span style={{ fontSize: 11, color: "#64748B" }}>{stats.trade_count} trade{stats.trade_count !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(148,163,184,0.12)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(pct * 100).toFixed(1)}%`,
              borderRadius: 4,
              background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
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
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20, fontStyle: "italic" }}>
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
    <div className="px-4 sm:px-8 py-5 sm:py-8 pb-12" style={{ maxWidth: 1100 }}>
      {/* Page Header */}
      <div className="mb-6">
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>System</h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>Building blocks. Performance. Configuration.</p>
      </div>

      {/* Sub-tab nav */}
      <div
        className="flex items-center gap-1 mb-8"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {(["Models", "Pairs", "Sessions"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative h-10 px-4 text-sm font-medium"
              style={{
                color: active ? "#F1F5F9" : "#64748B",
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
                    background: "#3B82F6",
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
