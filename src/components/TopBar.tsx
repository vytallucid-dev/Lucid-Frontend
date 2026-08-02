"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsFetching, useQueryClient, notifyManager } from "@tanstack/react-query";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { findActiveSection, findActiveSubtab } from "@/lib/nav";

// Derives the top bar's label from the same nav map the dock renders from
// (src/lib/nav.ts), plus — for routes with no matching sub-tab (a detail or
// diagnostic page) — the page's own <h1>, read from the DOM rather than
// duplicated into a second lookup table that could drift from the real copy.
function usePageTitle(pathname: string | null): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    // Runs after the new route's content has painted its own <h1>.
    const raf = requestAnimationFrame(() => {
      const h1 = document.querySelector("main h1");
      setTitle(h1?.textContent?.trim() || null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return title;
}

function useSectionLabel(pathname: string): { primary: string; secondary: string | null } {
  const section = findActiveSection(pathname);
  const pageTitle = usePageTitle(pathname);

  if (!section) return { primary: "Lucid", secondary: null };

  const subtab = findActiveSubtab(section, pathname);
  if (subtab) return { primary: section.label, secondary: subtab.label };

  // Section has sub-tabs but none matched this path — a detail/diagnostic
  // page nested under it (trade detail, account detail, USD Lab, V-Bottom,
  // Velocity, …). Use that page's own title rather than inventing one.
  if (section.subtabs && section.subtabs.length > 0) {
    return { primary: section.label, secondary: pageTitle };
  }

  // Section with no sub-tabs at all (Dashboard) — label alone, no trailing word.
  return { primary: section.label, secondary: null };
}

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
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { primary: sectionLabel, secondary: subLabel } = useSectionLabel(pathname);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  // Number of errored queries, read via useSyncExternalStore so the cache
  // subscription is render-safe. useSyncExternalStore alone makes the READ
  // side safe (no tearing), but it does not control WHEN onStoreChange gets
  // invoked — that's decided entirely by the store (the query cache), and a
  // subscriber can't control when the cache calls it. QueryCache.notify()
  // runs listeners through notifyManager.batch(), which is synchronous
  // (verified in the installed @tanstack/query-core source) — so an
  // unwrapped onStoreChange can still fire mid-render of whatever component
  // just triggered a cache event (e.g. a brand-new query key being added),
  // producing "Cannot update TopBar while rendering …". Wrapping in
  // notifyManager.batchCalls defers the actual onStoreChange call (it
  // schedules via setTimeout(0) internally) — the exact mechanism
  // react-query's own useIsFetching uses for this identical subscription
  // shape. This fixes it for every query key, not just one pre-warmed one.
  const errorCount = useSyncExternalStore(
    useCallback(
      (onStoreChange) =>
        queryClient.getQueryCache().subscribe(notifyManager.batchCalls(onStoreChange)),
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
        <span
          className="lt-serif text-base font-semibold truncate"
          style={{ color: "var(--lucid-ink)" }}
        >
          {sectionLabel}
        </span>
        {subLabel && (
          <>
            <span className="hidden sm:inline" style={{ color: "var(--lucid-ink-3)" }}>/</span>
            <span className="hidden sm:inline text-xs truncate" style={{ color: "var(--lucid-ink-3)" }}>
              {subLabel}
            </span>
          </>
        )}
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
