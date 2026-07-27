"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Maximize2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  expandHref?: string;
  title: string;
  /** Optional label shown above the title, e.g. a pair symbol or account type. */
  eyebrow?: string;
  children: React.ReactNode;
}

export function DetailDrawer({ open, onClose, expandHref, title, eyebrow, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, open);
  useScrollLock(drawerRef, open);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="lx-overlay-scrim fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="lx-drawer-panel fixed top-0 right-0 h-screen z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="lx-overlay-header">
          <div className="min-w-0">
            {eyebrow && <div className="lx-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
            <h2 className="lx-overlay-title truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {expandHref && (
              <Link
                href={expandHref}
                className="lx-overlay-close"
                title="Open full page"
              >
                <Maximize2 size={15} />
              </Link>
            )}
            <button onClick={onClose} className="lx-overlay-close" title="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="lx-overlay-body">
          {children}
        </div>
      </div>
    </>
  );
}
