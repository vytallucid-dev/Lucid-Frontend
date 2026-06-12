"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red, destructive styling for the confirm button (default true). */
  danger?: boolean;
  /** Disables buttons + shows a busy label while an async action runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation modal. Render it once near the component that owns the
 * action and drive it with local state:
 *
 *   const [confirm, setConfirm] = useState(false);
 *   <ConfirmDialog open={confirm} title="Delete trade?" danger
 *     onConfirm={doDelete} onCancel={() => setConfirm(false)} />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Esc (unless busy).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const accent = danger ? "#EF4444" : "#3B82F6";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
        onClick={() => { if (!loading) onCancel(); }}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl"
        style={{
          background: "rgba(12,18,30,0.98)",
          border: "1px solid rgba(148,163,184,0.14)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 38, height: 38, background: `${accent}1f`, border: `1px solid ${accent}40` }}
            >
              <AlertTriangle size={18} style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>{title}</h2>
              {message && (
                <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.55, marginTop: 6 }}>{message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "#94A3B8", opacity: loading ? 0.5 : 1 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: accent, color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
