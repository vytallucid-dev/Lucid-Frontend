"use client";

import { useSyncExternalStore, useEffect, useState } from "react";
import { X } from "lucide-react";
import { subscribe, getSnapshot, dismissToast } from "./toast-store";
import { TOAST_VARIANTS } from "./variants";
import type { ToastItem } from "./types";

function ToastCard({ item }: { item: ToastItem }) {
  const variant = TOAST_VARIANTS[item.type];
  const Icon = variant.icon;
  const [leaving, setLeaving] = useState(false);

  // Auto-dismiss timer (duration <= 0 means sticky).
  useEffect(() => {
    if (item.duration <= 0) return;
    const t = setTimeout(() => setLeaving(true), item.duration);
    return () => clearTimeout(t);
  }, [item.duration]);

  // Once the leave animation has played, remove from the store for real.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => dismissToast(item.id), 180);
    return () => clearTimeout(t);
  }, [leaving, item.id]);

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto relative overflow-hidden rounded-xl ${leaving ? "toast-leave" : "toast-enter"}`}
      style={{
        background: variant.background,
        border: `1px solid ${variant.border}`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02), 0 0 28px ${variant.glow}`,
        backdropFilter: "blur(14px)",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: variant.bar }}
      />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        <Icon size={18} style={{ color: variant.accent, flexShrink: 0, marginTop: 1 }} />

        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", lineHeight: 1.35 }}>
            {item.title ?? variant.defaultTitle}
          </p>
          <p style={{ fontSize: 12.5, color: "#94A3B8", lineHeight: 1.45, marginTop: 2, wordBreak: "break-word" }}>
            {item.message}
          </p>
        </div>

        <button
          onClick={() => setLeaving(true)}
          aria-label="Dismiss notification"
          className="p-1 rounded-md transition-colors hover:bg-white/10"
          style={{ color: "#64748B", flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar — counts down the remaining lifetime */}
      {item.duration > 0 && !leaving && (
        <div
          className="toast-progress"
          style={{
            height: 2,
            background: variant.bar,
            transformOrigin: "left",
            animationDuration: `${item.duration}ms`,
            opacity: 0.55,
          }}
        />
      )}
    </div>
  );
}

/**
 * Renders the toast stack. Mounted once at the root (see app/layout.tsx).
 * Pinned top-right on desktop, full-width across the top on mobile.
 */
export function ToastViewport() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-[200] flex flex-col gap-2.5 pointer-events-none top-4 right-4 left-4 sm:left-auto sm:top-5 sm:right-5"
      style={{ width: "auto", maxWidth: "100%" }}
    >
      <div className="flex flex-col gap-2.5 sm:w-[380px] sm:ml-auto">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
