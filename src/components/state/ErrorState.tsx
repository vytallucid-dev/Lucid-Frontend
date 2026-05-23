"use client";

import type { ReactElement } from "react";
import { ApiError } from "@/lib/api/client";

function extractMessage(error: Error | unknown): { code?: string; message: string } {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: Error | unknown;
  onRetry?: () => void;
  title?: string;
}): ReactElement {
  const { code, message } = extractMessage(error);
  const headline = title ?? "Something went wrong";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-4 py-12 px-6"
      role="alert"
    >
      <div
        className="glass-card p-6 max-w-md w-full"
        style={{
          background: "rgba(239, 68, 68, 0.06)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--band-strong-bearish)" }}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>
            {headline}
          </h3>
        </div>
        <div className="text-xs leading-relaxed mb-3" style={{ color: "#94A3B8" }}>
          {message}
        </div>
        {code && (
          <div
            className="text-xs font-mono mb-3"
            style={{ color: "#64748B" }}
          >
            code: {code}
          </div>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              color: "#FCA5A5",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
