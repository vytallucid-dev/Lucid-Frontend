"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NiftyToolsProvider } from "@/components/nifty-tools/NiftyToolsProvider";
import { NiftyToolsButton } from "@/components/nifty-tools/NiftyToolsButton";

const tabs = [
  { label: "Pulse", href: "/nifty/pulse" },
  { label: "Scorecard", href: "/nifty/scorecard" },
  { label: "History", href: "/nifty/history" },
  { label: "Patterns", href: "/nifty/patterns" },
];

export default function NiftyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isTabActive = (href: string) => pathname.startsWith(href);

  return (
    <NiftyToolsProvider>
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
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
                style={{ color: active ? "var(--lucid-ink)" : "var(--lucid-ink-3)" }}
              >
                {tab.label}
                {active && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: "var(--lucid-accent)" }}
                  />
                )}
              </Link>
            );
          })}
          <div className="flex-1" />
          <NiftyToolsButton />
        </div>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </NiftyToolsProvider>
  );
}
