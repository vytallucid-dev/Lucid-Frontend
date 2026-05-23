"use client";

import type { ReactElement } from "react";

export function LoadingState({ message }: { message?: string }): ReactElement {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "rgba(148, 163, 184, 0.5)", animationDelay: "0ms" }}
        />
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "rgba(148, 163, 184, 0.5)", animationDelay: "150ms" }}
        />
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "rgba(148, 163, 184, 0.5)", animationDelay: "300ms" }}
        />
      </div>
      {message && (
        <div className="text-xs tracking-wide" style={{ color: "#64748B" }}>
          {message}
        </div>
      )}
    </div>
  );
}
