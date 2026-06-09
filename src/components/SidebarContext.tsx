"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SidebarContextType {
  /** Desktop-only: sidebar rail collapsed to icons. */
  collapsed: boolean;
  /** Toggle the desktop collapsed rail. */
  toggle: () => void;
  /** Mobile/tablet: off-canvas drawer is open. */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  /** True below the `lg` breakpoint (the off-canvas drawer regime). */
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
  isMobile: false,
});

export function useSidebar() {
  return useContext(SidebarContext);
}

// Matches Tailwind's `lg` breakpoint. Below this the sidebar becomes an
// off-canvas overlay drawer instead of a persistent rail.
const MOBILE_QUERY = "(max-width: 1023px)";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Default to `false` (desktop) so SSR markup matches the desktop-first
  // layout; corrected on mount before paint via the effect below.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      setIsMobile(mql.matches);
      // Leaving the mobile regime should never strand an open drawer.
      if (!mql.matches) setMobileOpen(false);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen, isMobile]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((c) => !c),
        mobileOpen,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
        toggleMobile: () => setMobileOpen((o) => !o),
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
