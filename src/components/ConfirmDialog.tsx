"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

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
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useScrollLock(panelRef, open);

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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="lx-overlay-scrim"
        onClick={() => { if (!loading) onCancel(); }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="lx-modal-panel lx-modal-confirm relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "24px 24px 20px" }}>
          <div className="flex items-start gap-3">
            {danger && (
              <div className="lx-confirm-icon">
                <AlertTriangle size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="lx-overlay-title" style={{ fontSize: 16 }}>{title}</h2>
              {message && <p className="lx-body" style={{ marginTop: 6 }}>{message}</p>}
            </div>
          </div>
        </div>

        <div className="lx-overlay-footer">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="lx-btn lx-btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={danger ? "lx-btn lx-btn-danger" : "lx-btn lx-btn-primary"}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
