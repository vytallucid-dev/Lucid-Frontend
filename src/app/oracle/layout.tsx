"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OracleToolsProvider } from "@/components/oracle-tools/OracleToolsProvider";
import { ToolsButton } from "@/components/oracle-tools/ToolsButton";

const tabs = [
  { label: "Top Setups", href: "/oracle" },
  { label: "Asset Scorecard", href: "/oracle/scorecard" },
  { label: "FX Scorecard", href: "/oracle/fx-scorecard" },
  { label: "Heatmap", href: "/oracle/heatmap" },
  { label: "COT Report", href: "/oracle/cot" },
  { label: "Compass", href: "/oracle/compass" },
];

export default function OracleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <OracleToolsProvider>
      <div className="lt-backdrop flex flex-col min-h-[calc(100vh-56px)]">
        {/* Tab bar */}
        <div
          className="flex items-center gap-5 sm:gap-6 px-4 sm:px-6 h-11 shrink-0 overflow-x-auto no-scrollbar scroll-touch"
          style={{
            borderBottom: "1px solid var(--lucid-line)",
            background: "transparent",
          }}
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative h-full flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  color: active ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--lucid-ink-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--lucid-ink-3)";
                }}
              >
                {tab.label}
                {active && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      background: "linear-gradient(90deg, transparent, var(--lucid-accent), transparent)",
                      boxShadow: "0 0 12px rgba(205, 167, 79, 0.45)",
                    }}
                  />
                )}
              </Link>
            );
          })}
          <div className="flex-1" />
          <ToolsButton />
        </div>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </OracleToolsProvider>
  );
}
