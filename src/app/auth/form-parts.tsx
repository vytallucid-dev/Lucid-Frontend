"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function Field({
  label,
  htmlFor,
  input,
  error,
  hint,
}: {
  label: string;
  htmlFor: string;
  input: React.ReactNode;
  error?: string | null;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium mb-1.5"
        style={{ color: "#94A3B8" }}
      >
        {label}
      </label>
      {input}
      {error && (
        <p className="text-[11.5px] mt-1.5 flex items-center gap-1" style={{ color: "#F87171" }}>
          <AlertCircle size={11} />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-[11.5px] mt-1.5" style={{ color: "#64748B" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Banner({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles =
    kind === "error"
      ? {
          bg: "rgba(239, 68, 68, 0.07)",
          border: "rgba(239, 68, 68, 0.22)",
          color: "#FCA5A5",
          Icon: AlertCircle,
        }
      : kind === "success"
        ? {
            bg: "rgba(16, 185, 129, 0.07)",
            border: "rgba(16, 185, 129, 0.22)",
            color: "#6EE7B7",
            Icon: CheckCircle2,
          }
        : {
            bg: "rgba(59, 130, 246, 0.07)",
            border: "rgba(59, 130, 246, 0.22)",
            color: "#93C5FD",
            Icon: Info,
          };
  const Icon = styles.Icon;
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 mb-4 flex items-start gap-2.5 text-xs leading-relaxed"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
      }}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
