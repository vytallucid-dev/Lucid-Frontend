"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface DetailPageLayoutProps {
  backHref: string;
  backLabel?: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailPageLayout({
  backHref,
  backLabel = "Back",
  title,
  actions,
  children,
}: DetailPageLayoutProps) {
  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--bg-page)" }}>
      {/* Page header */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-6 py-4 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(2, 8, 23, 0.6)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80 shrink-0"
            style={{ color: "#64748B" }}
          >
            <ArrowLeft size={15} />
            <span>{backLabel}</span>
          </Link>
          <div
            className="w-px h-4 shrink-0"
            style={{ background: "rgba(148, 163, 184, 0.15)" }}
          />
          <h1
            className="text-lg sm:text-xl font-semibold truncate"
            style={{ color: "#E2E8F0" }}
          >
            {title}
          </h1>
        </div>

        {/* Right: action buttons */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
        {children}
      </div>
    </div>
  );
}
