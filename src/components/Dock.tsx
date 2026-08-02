"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Settings, Database, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { usePrefersReducedMotion } from "./motion";
import { requestTools, TOOLS_SECTIONS } from "@/lib/tools-store";
import { pendingStore, toggleHelp } from "@/lib/shortcuts-store";
import { SECTIONS, isSectionActive, isSubtabActive } from "@/lib/nav";

// Leaving the wrapper doesn't close the group immediately — it starts this
// timer, so a diagonal pointer path that briefly reads as "outside" (e.g. the
// natural arc from a pill up into the group) has time to land back inside
// before the group actually closes. Re-entering cancels it outright.
const CLOSE_DELAY_MS = 140;

export function Dock() {
  const pathname = usePathname() ?? "/";
  const { isAdmin } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Below `lg` (matches SidebarContext's own breakpoint), pills open on tap
  // instead of hover; a second tap on an already-open pill navigates.
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsTouch(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Clear any pending close timer on unmount so no setState fires after the
  // component is gone.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setOpenKey(null);
      closeTimer.current = null;
    }, CLOSE_DELAY_MS);
  }

  // Close on outside tap (touch regime) and on Escape (either regime).
  useEffect(() => {
    if (openKey === null) return;
    function onPointerDown(e: PointerEvent) {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const trigger = pillRefs.current.get(openKey!);
        setOpenKey(null);
        trigger?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKey]);

  function handleWrapperEnter() {
    if (isTouch) return;
    cancelClose();
  }

  function handleWrapperLeave() {
    if (isTouch) return;
    scheduleClose();
  }

  function handlePillEnter(key: string) {
    if (isTouch) return;
    // Cancel any pending close and swap straight to the new key — if a group
    // is already open this replaces it with no intermediate `null` frame, so
    // switching between pills swaps without a close-then-reopen flicker.
    cancelClose();
    setOpenKey(key);
  }

  function handlePillFocus(key: string) {
    cancelClose();
    setOpenKey(key);
  }

  function handleWrapperBlur(e: React.FocusEvent) {
    // Only close once focus has left the wrapper entirely — a focus move
    // between two elements inside it fires blur+focus in the same tick, and
    // relatedTarget tells us whether the new target is still inside.
    if (!dockRef.current) return;
    const next = e.relatedTarget as Node | null;
    if (!next || !dockRef.current.contains(next)) {
      setOpenKey(null);
    }
  }

  function handlePillClick(e: React.MouseEvent, key: string, hasSubtabs: boolean) {
    if (!isTouch || !hasSubtabs) return;
    // First tap raises the group; second tap (already open) lets the link
    // navigate normally.
    if (openKey !== key) {
      e.preventDefault();
      setOpenKey(key);
    } else {
      setOpenKey(null);
    }
  }

  const openSection = SECTIONS.find((s) => s.key === openKey) ?? null;

  // Armed `g` prefix. The whole indicator is one chip swapping its glyph, so
  // it costs no layout and reads as a state change rather than an event.
  const gPending = useSyncExternalStore(pendingStore.subscribe, pendingStore.get, () => false);

  return (
    // Single wrapper enclosing both the raised group and the dock bar. The
    // group is stacked in NORMAL FLOW above the bar (markup order: group,
    // then nav — plain flex-col renders the first child at the top), with
    // the visual gap coming from the flex container's own `gap-3` — flex gap
    // is allocated by the container itself, so unlike a margin on the group,
    // that space is genuinely inside the wrapper's hit-tested box. There is
    // no absolute positioning involved, so there's no ambiguity about which
    // box the gap belongs to. Enter/leave/blur are bound on this wrapper, not
    // the dock bar alone, so moving through the gap or between the bar and
    // the group never fires a leave.
    <div
      ref={dockRef}
      onMouseEnter={handleWrapperEnter}
      onMouseLeave={handleWrapperLeave}
      onBlur={handleWrapperBlur}
      className={[
        "fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50",
        "flex flex-col items-center",
        // 6px gap between the raised group and the bar. Flex gap, not a margin,
        // so the space is genuinely inside the wrapper's hit-tested box and a
        // pointer crossing it never fires a leave.
        openSection ? "gap-1.5" : "gap-0",
      ].join(" ")}
    >
      {/* Raised sub-tab group — normal flow, not absolutely positioned. */}
      {openSection && openSection.subtabs && (
        <div
          className={[
            "lucid-glass-2 lucid-dock-group max-w-[92vw] overflow-x-auto no-scrollbar scroll-touch",
            reducedMotion ? "" : "lucid-dock-pop",
          ].join(" ")}
          role="group"
          aria-label={`${openSection.label} sections`}
        >
          {openSection.subtabs.map((tab) => {
            const active = isSubtabActive(openSection.key, tab.href, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpenKey(null)}
                className={`lucid-dock-subpill shrink-0 ${active ? "is-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}

          {TOOLS_SECTIONS[openSection.key] && (
            <>
              <div aria-hidden="true" className="lucid-dock-divider" />
              <button
                type="button"
                onClick={() => {
                  requestTools(TOOLS_SECTIONS[openSection.key]);
                  setOpenKey(null);
                }}
                className="lucid-dock-subpill is-tools shrink-0"
              >
                <Wrench size={12} />
                Tools
              </button>
            </>
          )}
        </div>
      )}

      {/* The dock itself */}
      <nav aria-label="Primary" className="lucid-glass lucid-dock-bar">
        {SECTIONS.map((section) => {
          const active = isSectionActive(section.key, pathname);
          const hasSubtabs = section.subtabs !== null;
          const isOpen = openKey === section.key;
          return (
            <Link
              key={section.key}
              href={section.href}
              ref={(el) => {
                if (el) pillRefs.current.set(section.key, el);
                else pillRefs.current.delete(section.key);
              }}
              onMouseEnter={() => handlePillEnter(section.key)}
              onFocus={() => handlePillFocus(section.key)}
              onClick={(e) => handlePillClick(e, section.key, hasSubtabs)}
              className={[
                "lucid-dock-pill",
                active ? "is-active" : "",
                hasSubtabs ? "has-subtabs" : "",
                isOpen ? "is-open" : "",
              ].join(" ").trim()}
              aria-haspopup={hasSubtabs ? "true" : undefined}
              aria-expanded={hasSubtabs ? openKey === section.key : undefined}
            >
              <section.icon size={15} />
              <span className="hidden sm:inline">{section.label}</span>
            </Link>
          );
        })}

        <div aria-hidden="true" className="lucid-dock-divider" />

        {/* Shortcut hint. Deliberately the quietest thing in the bar — it is a
            footnote for the one moment someone wonders whether there are any,
            not a call to action. Doubles as the click-path to the panel, and
            as the pending-`g` indicator. */}
        <button
          type="button"
          onClick={toggleHelp}
          className={`lucid-dock-hint ${gPending ? "is-pending" : ""}`}
          title={gPending ? "Waiting for the second key…" : "Keyboard shortcuts"}
          aria-label="Keyboard shortcuts"
        >
          <kbd className="lx-kbd">{gPending ? "g" : "?"}</kbd>
        </button>

        <Link
          href="/lucid"
          className={`lucid-dock-icon ${pathname.startsWith("/lucid") ? "is-active" : ""}`}
          title="Lucid"
          aria-label="Lucid AI Chat"
        >
          <MessageSquare size={15} />
        </Link>
        <Link
          href="/settings"
          className={`lucid-dock-icon ${pathname.startsWith("/settings") ? "is-active" : ""}`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={15} />
        </Link>
        {isAdmin && (
          <Link
            href="/data"
            className={`lucid-dock-icon ${pathname.startsWith("/data") ? "is-active" : ""}`}
            title="Data"
            aria-label="Data — Admin Pipelines"
          >
            <Database size={15} />
          </Link>
        )}
      </nav>
    </div>
  );
}
