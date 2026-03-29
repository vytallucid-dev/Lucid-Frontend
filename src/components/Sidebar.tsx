"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Telescope, Settings } from "lucide-react";

const navItems = [
  { label: "Pulse", sublabel: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Ledger", sublabel: "Journal", href: "/ledger", icon: BookOpen },
  { label: "Oracle", sublabel: "Scanner", href: "/oracle", icon: Telescope },
  { label: "Settings", sublabel: "", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[220px] flex flex-col z-50"
      style={{
        background: "rgba(2, 8, 23, 0.8)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-8">
        <h1
          className="text-xl font-bold tracking-tight"
          style={{ color: "#3B82F6" }}
        >
          LUCID
        </h1>
        <span
          className="text-[11px] font-medium tracking-widest uppercase"
          style={{ color: "#334155" }}
        >
          Trading OS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative"
              style={{
                background: active
                  ? "rgba(59, 130, 246, 0.08)"
                  : "transparent",
                borderLeft: active
                  ? "2px solid #3B82F6"
                  : "2px solid transparent",
              }}
            >
              <item.icon
                size={18}
                style={{ color: active ? "#3B82F6" : "#64748B" }}
              />
              <div className="flex flex-col">
                <span
                  className="text-sm font-medium leading-tight"
                  style={{ color: active ? "#F1F5F9" : "#94A3B8" }}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <span
                    className="text-[10px]"
                    style={{ color: "#64748B" }}
                  >
                    {item.sublabel}
                  </span>
                )}
              </div>
              {active && (
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    boxShadow: "0 0 20px rgba(59, 130, 246, 0.1)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Version */}
      <div className="px-5 py-4">
        <span
          className="text-[10px] font-medium tracking-wider"
          style={{ color: "#334155" }}
        >
          v1.0 Beta
        </span>
      </div>
    </aside>
  );
}
