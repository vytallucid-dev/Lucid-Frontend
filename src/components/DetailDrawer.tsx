"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Maximize2 } from "lucide-react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  expandHref?: string;
  title: string;
  children: React.ReactNode;
}

export function DetailDrawer({ open, onClose, expandHref, title, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0, 0, 0, 0.4)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-screen z-50 flex flex-col drawer-enter"
        style={{
          width: 480,
          background: "rgba(10, 18, 30, 0.97)",
          backdropFilter: "blur(16px)",
          borderLeft: "1px solid rgba(148, 163, 184, 0.12)",
          boxShadow: "-8px 0 40px rgba(0, 0, 0, 0.5)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}
        >
          <h2
            className="text-base font-semibold truncate"
            style={{ color: "#E2E8F0" }}
          >
            {title}
          </h2>
          <div className="flex items-center gap-1">
            {expandHref && (
              <Link
                href={expandHref}
                className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                style={{ color: "#64748B" }}
                title="Open full page"
              >
                <Maximize2 size={15} />
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover:bg-white/5"
              style={{ color: "#64748B" }}
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </>
  );
}
