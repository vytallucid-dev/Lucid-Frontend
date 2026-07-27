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
          background: "var(--lucid-neg-bg)",
          border: "1px solid var(--lucid-neg-bd)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--band-strong-bearish)" }}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
            {headline}
          </h3>
        </div>
        <div className="text-xs leading-relaxed mb-3" style={{ color: "var(--lucid-ink-2)" }}>
          {message}
        </div>
        {code && (
          <div
            className="text-xs font-mono mb-3"
            style={{ color: "var(--lucid-ink-3)" }}
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
              background: "var(--lucid-neg-bg)",
              color: "var(--lucid-neg)",
              border: "1px solid var(--lucid-neg-bd)",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
