"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, User as UserIcon, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useSidebar } from "./SidebarContext";

const sectionNames: Record<string, string> = {
  "/": "Pulse",
  "/ledger": "Ledger",
  "/oracle": "Oracle",
  "/settings": "Settings",
};

function formatIst(date: Date): string {
  const day = date.toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Last viewed: ${day} — ${time} IST`;
}

function getInitials(fullName: string | undefined, email: string | undefined): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "—";
}

type Status = "idle" | "fetching" | "error";

const SCROLL_THRESHOLD = 12;

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const section =
    sectionNames[pathname] ||
    sectionNames[
      Object.keys(sectionNames).find((k) => k !== "/" && pathname.startsWith(k)) || "/"
    ] ||
    "Lucid";

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  // Number of errored queries, read via useSyncExternalStore so the cache
  // subscription is render-safe: React schedules the update instead of us
  // calling setState synchronously inside the cache's notify callback (which,
  // when another component's render triggers a cache change, produced the
  // "Cannot update TopBar while rendering …" warning under React 19).
  const errorCount = useSyncExternalStore(
    useCallback(
      (onStoreChange) => queryClient.getQueryCache().subscribe(onStoreChange),
      [queryClient],
    ),
    () =>
      queryClient
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.status === "error").length,
    () => 0,
  );
  const hasError = errorCount > 0;

  const status: Status = hasError ? "error" : isFetching > 0 ? "fetching" : "idle";

  const statusColor =
    status === "error"
      ? "var(--lucid-neg)"
      : status === "fetching"
        ? "var(--lucid-warn)"
        : "var(--lucid-pos)";
  const statusLabel =
    status === "error" ? "Error" : status === "fetching" ? "Fetching" : "Idle";
  const statusTooltip =
    status === "error"
      ? `${errorCount} quer${errorCount === 1 ? "y" : "ies"} errored`
      : status === "fetching"
        ? `${isFetching} quer${isFetching === 1 ? "y" : "ies"} fetching`
        : "No active queries";

  // Auth menu
  const { user, loading, signOut } = useAuth();
  const { toggleMobile } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? undefined;
  const initials = getInitials(fullName, user?.email);

  // Scroll-reactive chrome: transparent at rest, translucent warm blur once the
  // page has scrolled past the threshold. Attached to `window` — the app shell
  // has no internal scroll container (MainContent/body have no overflow-y set,
  // Sidebar is `fixed`), so the document itself is what actually scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <header
      className={[
        "flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 sticky top-0 z-30",
        scrolled ? "h-12 lt-topbar-scrolled" : "h-14 lt-topbar-rest",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={toggleMobile}
          className="lg:hidden -ml-1 p-2 rounded-md hover:bg-white/5 transition-colors shrink-0"
          style={{ color: "var(--lucid-ink-3)" }}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <span
          className="lt-serif text-base font-semibold truncate"
          style={{ color: "var(--lucid-ink)" }}
        >
          {section}
        </span>
        <span className="hidden sm:inline" style={{ color: "var(--lucid-ink-3)" }}>/</span>
        <span className="hidden sm:inline text-xs" style={{ color: "var(--lucid-ink-3)" }}>
          Overview
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <span className="hidden md:inline text-xs lt-num" style={{ color: "var(--lucid-ink-3)" }}>
          {now ? formatIst(now) : ""}
        </span>
        <div className="flex items-center gap-1.5" title={statusTooltip}>
          <div
            className={
              status === "fetching" ? "w-2 h-2 rounded-full pulse-live" : "w-2 h-2 rounded-full"
            }
            style={{ background: statusColor }}
          />
          <span className="hidden sm:inline text-xs font-medium" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        {/* User menu */}
        {loading ? (
          <div
            className="w-8 h-8 rounded-full"
            style={{ background: "var(--lucid-surface-2)" }}
          />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors"
              style={{
                background: "var(--lucid-accent-bg)",
                color: "var(--lucid-accent)",
                border: "1px solid var(--lucid-accent-bd)",
              }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="User menu"
            >
              {initials !== "—" ? initials : <UserIcon size={14} />}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 rounded-xl overflow-hidden"
                style={{
                  zIndex: 9999,
                  background: "var(--lucid-surface-2)",
                  border: "1px solid var(--lucid-line)",
                  minWidth: 220,
                }}
              >
                <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--lucid-ink)" }}>
                    {fullName ?? user.email ?? "Account"}
                  </div>
                  {user.email && fullName && (
                    <div className="text-[11px] truncate" style={{ color: "var(--lucid-ink-3)" }}>
                      {user.email}
                    </div>
                  )}
                </div>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-(--lucid-ink-2) hover:text-(--lucid-ink) hover:bg-(--lucid-line) transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-(--lucid-line) transition-colors text-left"
                  style={{ color: "var(--lucid-neg)" }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
