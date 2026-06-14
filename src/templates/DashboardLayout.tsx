import React, { useEffect, useState } from "react";
import { Navbar } from "../organisms/Navbar";
import Sidebar from "@/organisms/SidebarV2";
import { TopBar } from "../organisms/TopBar/TopBar";
import { useDarkMode } from "../hooks/useDarkMode";
import { useIOSViewport } from "../hooks/useIOSViewport";
import { useLayoutMode } from "../hooks/useLayoutMode";

const STORAGE_KEY = "uttm_sidebar_collapsed_v4";
const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const DURATION = "200ms";

const useIsMobileOrTablet = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return isMobile;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  useDarkMode();      // applies/removes .dark on <html> — all var(--*) tokens flip automatically
  useIOSViewport();   // sets --vh, handles keyboard resize on iOS
  const isMobileOrTablet = useIsMobileOrTablet();
  const [layoutMode] = useLayoutMode();
  const isCompact = layoutMode === "compact";

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed));
    } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setSidebarCollapsed(e.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const spacerWidth = isMobileOrTablet
    ? 0
    : sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  void spacerWidth; // used by layout calculation above, suppress unused warning

  return (
    <div
      className="dashboard-shell"
      style={{
        width:              "100%",
        overflow:           "hidden",
        overscrollBehavior: "none",
        backgroundColor:    "var(--sc-shell)",
        display:            "flex",
        gap:                isMobileOrTablet || isCompact ? 0 : "6px",
        boxSizing:          "border-box",
        // compact overrides the CSS safe-area padding to 0
        ...(isCompact && !isMobileOrTablet ? { padding: 0 } : {}),
      }}
    >
      {/* ── Sidebar card ─────────────────────────────────────────────────── */}
      {!isMobileOrTablet && (
        <div
          style={{
            flexShrink:      0,
            width:           sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
            overflow:        "hidden",
            borderRadius:    isCompact ? 0 : "8px",
            border:          isCompact ? "none" : "1px solid var(--sb-border)",
            borderRight:     isCompact ? "1px solid var(--sb-border)" : undefined,
            backgroundColor: "var(--sb-bg)",
            transition:      `width ${DURATION} ${EASE}`,
            willChange:      "width",
            transform:       "translateZ(0)",
          }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>
      )}

      {isMobileOrTablet && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}

      {/* ── Right panel shell ────────────────────────────────────────────── */}
      <div
        style={{
          flex:          1,
          minWidth:      0,
          display:       "flex",
          flexDirection: "column",
          height:        "100%",
          overflow:      "auto",
        }}
      >
        {isMobileOrTablet && <Navbar />}

        {/* ── Content card ─────────────────────────────────────────────── */}
        <div
          className="content-card"
          style={{
            flex:            1,
            display:         "flex",
            flexDirection:   "column",
            overflow:        "hidden",
            borderRadius:    isCompact ? 0 : "8px",
            backgroundColor: "var(--sc-card)",
            border:          isCompact ? "none" : "1px solid var(--sc-border)",
          }}
        >
          {/* ── Top bar: workspace name | global search | profile ─────── */}
          <TopBar />

          {/* ── Scrollable content ───────────────────────────────────── */}
          <main
            className="sc-scrollbar"
            style={{
              flex:          1,
              overflowY:     "auto",
              overflowX:     "hidden",
              display:       "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: "100%", boxSizing: "border-box" }}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
