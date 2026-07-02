"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, NotebookPen, Telescope, MessageSquare, Settings, ChevronsLeft, ChevronsRight, Activity, Database, X } from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/lib/auth/auth-context";

const navItems = [
  { label: "Dashboard", sublabel: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Trading Hub", sublabel: "Journal & Accounts", href: "/trading/journal", icon: NotebookPen },
  { label: "NIFTY", sublabel: "Fundamental Bias", href: "/nifty/pulse", icon: Activity },
  { label: "Scanner", sublabel: "Oracle", href: "/oracle", icon: Telescope },
  { label: "Lucid", sublabel: "AI Chat", href: "/lucid", icon: MessageSquare },
  { label: "Settings", sublabel: "", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
  const { isAdmin } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    if (href === "/trading/journal") return pathname.startsWith("/trading");
    if (href === "/nifty/pulse") return pathname.startsWith("/nifty");
    return pathname.startsWith(href);
  };

  const visibleNavItems = [
    ...navItems,
    ...(isAdmin
      ? [{ label: "Data", sublabel: "Admin Pipelines", href: "/data", icon: Database }]
      : []),
  ];

  // `collapsed` only ever applies at `lg+` (it's a desktop rail toggle). The
  // overlay drawer below `lg` always shows full-width labels. Because the
  // rest position / width are CSS-driven, mobile paints correctly first frame.
  return (
    <>
      {/* Mobile backdrop — hidden at lg+, fades with the drawer below it */}
      <div
        onClick={closeMobile}
        aria-hidden="true"
        className="fixed inset-0 z-40 lg:hidden transition-opacity duration-300"
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
        }}
      />

      <aside
        className={[
          "fixed top-0 left-0 h-screen flex flex-col z-50",
          "transition-[transform,width] duration-300",
          // Width: full-label drawer below lg; rail width at lg+.
          "w-67",
          collapsed ? "lg:w-16" : "lg:w-55",
          // Rest position: off-canvas below lg unless opened; always on at lg+.
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
        style={{
          background: "var(--lucid-surface)",
          borderRight: "1px solid var(--lucid-line)",
        }}
      >
        {/* Logo + collapse / close toggle */}
        <div className="flex items-center justify-between px-4 pt-6 pb-8">
          {/* Full wordmark — always on the mobile drawer; on desktop only when expanded */}
          <div className={collapsed ? "block lg:hidden" : "block"}>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--lucid-accent)", fontFamily: "var(--lucid-font-serif)" }}
            >
              LUCID
            </h1>
            <span
              className="text-[11px] font-medium tracking-widest uppercase"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              Trading OS
            </span>
          </div>
          {/* Compact "L" mark — only on the collapsed desktop rail */}
          {collapsed && (
            <h1
              className="hidden lg:block text-lg font-bold tracking-tight mx-auto"
              style={{ color: "var(--lucid-accent)", fontFamily: "var(--lucid-font-serif)" }}
            >
              L
            </h1>
          )}

          {/* Close (mobile drawer) */}
          <button
            onClick={closeMobile}
            className="lg:hidden p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--lucid-ink-3)" }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
          {/* Collapse rail (desktop) */}
          <button
            onClick={toggle}
            className="hidden lg:block p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--lucid-ink-3)" }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
          {/* Section label — only where there's room to render the eyebrow + hairline;
              the collapsed lg+ rail is icon-only, so this hides there. */}
          <div className={collapsed ? "hidden lg:hidden px-2 pb-2" : "flex lg:flex px-2 pb-2"}>
            <span className="lt-eyebrow" style={{ width: "100%" }}>
              Menu
              <span className="lt-eyebrow-ln" />
            </span>
          </div>
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            // Collapsed visuals apply only at lg+; the drawer is always full.
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={[
                  "flex items-center gap-3 rounded-lg transition-all duration-200 group relative",
                  collapsed
                    ? "px-3 lg:px-0 py-2.5 justify-start lg:justify-center"
                    : "px-3 py-2.5 justify-start",
                  active ? "" : "hover:bg-(--lucid-line)",
                ].join(" ")}
                style={{
                  background: active ? "var(--lucid-accent-bg)" : "transparent",
                  borderLeft: active ? "2px solid var(--lucid-accent)" : "2px solid transparent",
                }}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  size={18}
                  className={active ? "" : "text-(--lucid-ink-3) group-hover:text-(--lucid-ink)"}
                  style={active ? { color: "var(--lucid-ink)", flexShrink: 0 } : { flexShrink: 0 }}
                />
                <div
                  className={[
                    "flex flex-col overflow-hidden",
                    collapsed ? "flex lg:hidden" : "flex",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-sm font-medium leading-tight",
                      active ? "" : "text-(--lucid-ink-2) group-hover:text-(--lucid-ink)",
                    ].join(" ")}
                    style={active ? { color: "var(--lucid-ink)" } : undefined}
                  >
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                      {item.sublabel}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Version */}
        <div className="px-4 py-4">
          <span
            className={[
              "text-[10px] font-medium tracking-wider",
              collapsed ? "block lg:hidden" : "block",
            ].join(" ")}
            style={{ color: "var(--lucid-ink-3)" }}
          >
            v1.0 Beta
          </span>
        </div>
      </aside>
    </>
  );
}
