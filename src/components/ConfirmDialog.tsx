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

  const accent = danger ? "var(--lucid-neg)" : "var(--lucid-accent)";
  const accentBg = danger ? "var(--lucid-neg-bg)" : "var(--lucid-accent-bg)";
  const accentBd = danger ? "var(--lucid-neg-bd)" : "var(--lucid-accent-bd)";
  const confirmText = danger ? "var(--lucid-ink)" : "var(--lucid-bg)";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={() => { if (!loading) onCancel(); }}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="lt-edge relative w-full max-w-sm rounded-2xl"
        style={{
          background: "var(--lucid-surface-2)",
          border: "1px solid var(--lucid-line)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 38, height: 38, background: accentBg, border: `1px solid ${accentBd}` }}
            >
              <AlertTriangle size={18} style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <h2 className="lt-serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--lucid-ink)" }}>{title}</h2>
              {message && (
                <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.55, marginTop: 6 }}>{message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--lucid-line)" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)", opacity: loading ? 0.5 : 1 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: accent, color: confirmText, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
