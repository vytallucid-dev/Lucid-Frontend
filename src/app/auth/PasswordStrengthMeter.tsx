"use client";

import { passwordStrength } from "./auth-utils";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, strength } = passwordStrength(password);
  if (strength === "empty") return null;

  const segments = [0, 1, 2, 3];
  const color =
    strength === "weak"
      ? "#EF4444"
      : strength === "medium"
        ? "#F59E0B"
        : "#10B981";

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {segments.map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              background: i < score ? color : "rgba(148, 163, 184, 0.15)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium tabular-nums" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
