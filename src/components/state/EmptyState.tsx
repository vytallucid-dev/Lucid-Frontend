"use client";

import type { ReactElement, ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}): ReactElement {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3 py-12 px-6 text-center"
      role="status"
    >
      {icon && (
        <div style={{ color: "var(--lucid-ink-3)" }} aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold" style={{ color: "var(--lucid-ink-2)" }}>
        {title}
      </h3>
      {description && (
        <p
          className="text-xs leading-relaxed max-w-sm"
          style={{ color: "var(--lucid-ink-3)" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
