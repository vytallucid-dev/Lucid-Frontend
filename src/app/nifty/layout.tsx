"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Pulse", href: "/nifty/pulse" },
  { label: "Scorecard", href: "/nifty/scorecard" },
  { label: "Velocity", href: "/nifty/velocity" },
  { label: "V-Bottom", href: "/nifty/v-bottom" },
  { label: "USD Lab", href: "/nifty/usd-lab" },
  { label: "History", href: "/nifty/history" },
  { label: "Patterns", href: "/nifty/patterns" },
];

export default function NiftyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isTabActive = (href: string) => pathname.startsWith(href);

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
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative h-full flex items-center text-sm font-medium transition-colors"
              style={{ color: active ? "#F1F5F9" : "#64748B" }}
            >
              <span className="hover:text-[#94A3B8] transition-colors">{tab.label}</span>
              {active && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
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
