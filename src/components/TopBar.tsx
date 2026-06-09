"use client";

import { useEffect, useRef, useState } from "react";
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
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const recompute = () => {
      const queries = cache.getAll();
      const errored = queries.filter((q) => q.state.status === "error").length;
      setErrorCount(errored);
      setHasError(errored > 0);
    };
    recompute();
    return cache.subscribe(recompute);
  }, [queryClient]);

  const status: Status = hasError ? "error" : isFetching > 0 ? "fetching" : "idle";

  const statusColor =
    status === "error" ? "#EF4444" : status === "fetching" ? "#F59E0B" : "#10B981";
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

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <header
      className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 sticky top-0 z-30"
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        background: "rgba(2, 8, 23, 0.6)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={toggleMobile}
          className="lg:hidden -ml-1 p-2 rounded-md hover:bg-white/5 transition-colors shrink-0"
          style={{ color: "#94A3B8" }}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <span className="text-sm font-semibold truncate" style={{ color: "#F1F5F9" }}>
          {section}
        </span>
        <span className="hidden sm:inline" style={{ color: "#334155" }}>/</span>
        <span className="hidden sm:inline text-sm" style={{ color: "#64748B" }}>
          Overview
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <span className="hidden md:inline text-xs" style={{ color: "#64748B" }}>
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
            style={{ background: "rgba(148, 163, 184, 0.08)" }}
          />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors"
              style={{
                background: "rgba(59, 130, 246, 0.12)",
                color: "#93C5FD",
                border: "1px solid rgba(59, 130, 246, 0.25)",
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
                  background: "rgba(10, 18, 30, 0.98)",
                  border: "1px solid rgba(148, 163, 184, 0.12)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                  backdropFilter: "blur(16px)",
                  minWidth: 220,
                }}
              >
                <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                  <div className="text-sm font-medium truncate" style={{ color: "#F1F5F9" }}>
                    {fullName ?? user.email ?? "Account"}
                  </div>
                  {user.email && fullName && (
                    <div className="text-[11px] truncate" style={{ color: "#64748B" }}>
                      {user.email}
                    </div>
                  )}
                </div>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: "#94A3B8" }}
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-left"
                  style={{ color: "#FCA5A5" }}
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
