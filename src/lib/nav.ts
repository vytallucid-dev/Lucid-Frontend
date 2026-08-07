import {
  BarChart3,
  NotebookPen,
  Activity,
  Telescope,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the app's primary navigation — every section,
// its icon, and its sub-tabs with their exact user-facing labels. Dock.tsx
// renders from this; TopBar.tsx derives its section/sub-tab label from it
// too, so the two can never drift out of sync (e.g. a tab rename only needs
// to happen here).

export interface NavSubtab {
  label: string;
  href: string;
}

export interface NavSection {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  subtabs: NavSubtab[] | null;
}

export const SECTIONS: NavSection[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    subtabs: null,
  },
  {
    key: "trading",
    label: "Trading Hub",
    href: "/trading/journal",
    icon: NotebookPen,
    subtabs: [
      { label: "Journal", href: "/trading/journal" },
      { label: "Planned Trades", href: "/trading/planned" },
      { label: "Accounts", href: "/trading/accounts" },
      { label: "System", href: "/trading/system" },
      { label: "Analytics", href: "/trading/analytics" },
    ],
  },
  {
    key: "nifty",
    label: "NIFTY",
    href: "/nifty/pulse",
    icon: Activity,
    subtabs: [
      { label: "Pulse", href: "/nifty/pulse" },
      { label: "Scorecard", href: "/nifty/scorecard" },
      { label: "History", href: "/nifty/history" },
      { label: "Patterns", href: "/nifty/patterns" },
    ],
  },
  {
    key: "oracle",
    label: "Oracle",
    href: "/oracle",
    icon: Telescope,
    subtabs: [
      { label: "Top Setups", href: "/oracle" },
      { label: "Asset Scorecard", href: "/oracle/scorecard" },
      { label: "FX Scorecard", href: "/oracle/fx-scorecard" },
      { label: "Heatmap", href: "/oracle/heatmap" },
      { label: "COT Report", href: "/oracle/cot" },
      { label: "Compass", href: "/oracle/compass" },
    ],
  },
  {
    // Top-level surface, peer to Oracle and NIFTY rather than a sub-tab of
    // either — the calendar spans every tracked currency, so it does not
    // belong inside a single tool's section.
    key: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    // Fix 4: History is a distinct, deep-linkable route rather than a mode
    // toggle on the live page — a shared week/range URL only survives a
    // reload if it's the actual route, not client-only state.
    subtabs: [
      { label: "Live", href: "/calendar" },
      { label: "History", href: "/calendar/history" },
    ],
  },
];

export function isSectionActive(key: string, pathname: string): boolean {
  if (key === "dashboard") return pathname === "/dashboard" || pathname === "/";
  if (key === "trading") return pathname.startsWith("/trading");
  if (key === "nifty") return pathname.startsWith("/nifty");
  if (key === "oracle") return pathname.startsWith("/oracle");
  if (key === "calendar") return pathname.startsWith("/calendar");
  return false;
}

export function isSubtabActive(key: string, href: string, pathname: string): boolean {
  // Mirrors each section's own layout.tsx matching rule exactly.
  if (key === "oracle") return pathname === href;
  // Exact match, not startsWith: "/calendar" is a literal prefix of
  // "/calendar/history" (Fix 4's new subtab), so startsWith would light up
  // both tabs on the history page. Trading and NIFTY never hit this because
  // none of their subtab hrefs prefix one another.
  if (key === "calendar") return pathname === href;
  // Trading + NIFTY both use startsWith against each sub-tab's own href.
  return pathname.startsWith(href);
}

export function findActiveSection(pathname: string): NavSection | null {
  return SECTIONS.find((s) => isSectionActive(s.key, pathname)) ?? null;
}

export function findActiveSubtab(section: NavSection, pathname: string): NavSubtab | null {
  if (!section.subtabs) return null;
  return section.subtabs.find((tab) => isSubtabActive(section.key, tab.href, pathname)) ?? null;
}
