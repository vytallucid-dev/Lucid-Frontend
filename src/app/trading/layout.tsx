"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Journal", href: "/trading/journal" },
  { label: "Planned Trades", href: "/trading/planned" },
  { label: "Accounts", href: "/trading/accounts" },
  { label: "System", href: "/trading/system" },
  { label: "Analytics", href: "/trading/analytics" },
];

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    // For detail routes like /trading/journal/[id], keep the parent tab active
    if (href === "/trading/journal") return pathname.startsWith("/trading/journal");
    if (href === "/trading/planned") return pathname.startsWith("/trading/planned");
    if (href === "/trading/accounts") return pathname.startsWith("/trading/accounts");
    if (href === "/trading/system") return pathname.startsWith("/trading/system");
    if (href === "/trading/analytics") return pathname.startsWith("/trading/analytics");
    return pathname === href;
  };

  return (
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
          const active = isTabActive(tab.href);
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
      </div>

      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
