"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

/**
 * Branded loading state. Pass `message` for a single status line, or `stages`
 * for a sequence ("Loading trades…" → "Computing edge…") that advances every
 * ~1.1s and holds on the last line. Purely presentational — it never delays
 * real data; if the query resolves instantly this simply never renders long
 * enough to matter.
 */
export function LoadingState({
  message,
  stages,
}: {
  message?: string;
  stages?: string[];
}): ReactElement {
  const lines = stages && stages.length > 0 ? stages : message ? [message] : [];
  const linesKey = lines.join("|");
  const [idx, setIdx] = useState(0);

  // Reset the stage cursor when the line set changes — the documented
  // "adjust state during render" pattern (no effect, no cascading render).
  const [prevKey, setPrevKey] = useState(linesKey);
  if (prevKey !== linesKey) {
    setPrevKey(linesKey);
    setIdx(0);
  }

  useEffect(() => {
    if (lines.length <= 1) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1 < lines.length ? i + 1 : i)),
      1100,
    );
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--lucid-accent)", animationDelay: "0ms" }}
        />
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--lucid-accent)", animationDelay: "150ms" }}
        />
        <span
          className="block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--lucid-accent)", animationDelay: "300ms" }}
        />
      </div>
      {lines.length > 0 && (
        <div
          key={idx}
          className="lt-fade-in text-xs tracking-wide"
          style={{ color: "var(--lucid-ink-3)" }}
        >
          {lines[idx]}
        </div>
      )}
    </div>
  );
}
