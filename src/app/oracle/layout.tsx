"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Top Setups", href: "/oracle" },
  { label: "Asset Scorecard", href: "/oracle/scorecard" },
  { label: "FX Scorecard", href: "/oracle/fx-scorecard" },
  { label: "Heatmap", href: "/oracle/heatmap" },
  { label: "COT Report", href: "/oracle/cot" },
];

export default function OracleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Tab bar */}
      <div
        className="flex items-center gap-6 px-6 h-11 shrink-0"
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          background: "rgba(2, 8, 23, 0.4)",
        }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative h-full flex items-center text-sm font-medium transition-colors"
              style={{
                color: active ? "#F1F5F9" : "#64748B",
              }}
            >
              {tab.label}
              {active && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: "#3B82F6" }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
