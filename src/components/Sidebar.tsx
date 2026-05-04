"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, NotebookPen, Telescope, MessageSquare, Settings, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { label: "Dashboard", sublabel: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Trading Hub", sublabel: "Journal & Accounts", href: "/trading/journal", icon: NotebookPen },
  { label: "Scanner", sublabel: "Oracle", href: "/oracle", icon: Telescope },
  { label: "Lucid", sublabel: "AI Chat", href: "/lucid", icon: MessageSquare },
  { label: "Settings", sublabel: "", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    // Trading Hub: match any /trading/* route
    if (href === "/trading/journal") return pathname.startsWith("/trading");
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-50 transition-all duration-300"
      style={{
        width: collapsed ? 64 : 220,
        background: "rgba(2, 8, 23, 0.8)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 pt-6 pb-8">
        <div className={collapsed ? "hidden" : "block"}>
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
        {collapsed && (
          <h1
            className="text-lg font-bold tracking-tight mx-auto"
            style={{ color: "#3B82F6" }}
          >
            L
          </h1>
        )}
        <button
          onClick={toggle}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: "#64748B" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg transition-all duration-200 group relative"
              style={{
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active
                  ? "rgba(59, 130, 246, 0.08)"
                  : "transparent",
                borderLeft: active
                  ? "2px solid #3B82F6"
                  : "2px solid transparent",
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                size={18}
                style={{ color: active ? "#3B82F6" : "#64748B", flexShrink: 0 }}
              />
              {!collapsed && (
                <div className="flex flex-col overflow-hidden">
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
              )}
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
      <div className="px-4 py-4">
        {!collapsed && (
          <span
            className="text-[10px] font-medium tracking-wider"
            style={{ color: "#334155" }}
          >
            v1.0 Beta
          </span>
        )}
      </div>
    </aside>
  );
}
