/**
 * DashboardSkeleton.tsx — full-page skeleton for /dashboard/admin and /dashboard/manager.
 * Mirrors the exact layout of DashboardLayout + AdminDashboard so the transition
 * from skeleton → real page is seamless.
 *
 * Renders: sidebar chrome + topbar + 6 stat cards + line chart + 2 side-by-side charts
 *          + 2-row recent bookings table (the "two copies" the user sees).
 */
import React from "react";
import { SkeletonBlock } from "./SkeletonBlock";
import { SidebarShellSkeleton, TopBarShellSkeleton } from "./LayoutShells";

// ── Stat card skeleton — mirrors StatCard structure ───────────────────────────

const StatCardSkeleton: React.FC = () => (
  <div
    style={{
      background:    "var(--sc-card)",
      border:        "1px solid var(--sc-border)",
      borderRadius:  10,
      padding:       "13px 14px",
      display:       "flex",
      flexDirection: "column",
      gap:           9,
    }}
  >
    {/* Icon badge + change pill */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <SkeletonBlock width={34} height={34} borderRadius={8} />
      <SkeletonBlock width={52} height={20} borderRadius={99} />
    </div>
    {/* Value + title + period */}
    <div>
      <SkeletonBlock width="55%" height={22} borderRadius={4} style={{ marginBottom: 6 }} />
      <SkeletonBlock width="72%" height={12} borderRadius={3} style={{ marginBottom: 5 }} />
      <SkeletonBlock width="48%" height={10} borderRadius={3} />
    </div>
  </div>
);

// ── Chart card skeleton — mirrors ChartCard wrapper ───────────────────────────

const ChartCardSkeleton: React.FC<{ minHeight?: number }> = ({ minHeight = 210 }) => (
  <div
    style={{
      background:    "var(--sc-card)",
      border:        "1px solid var(--sc-border)",
      borderRadius:  10,
      overflow:      "hidden",
      boxShadow:     "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    {/* Header row */}
    <div
      style={{
        padding:      "10px 14px",
        borderBottom: "1px solid var(--sc-border)",
      }}
    >
      <SkeletonBlock width={130} height={13} borderRadius={3} style={{ marginBottom: 6 }} />
      <SkeletonBlock width={200} height={11} borderRadius={3} />
    </div>
    {/* Chart area */}
    <div style={{ padding: 14, minHeight, boxSizing: "border-box" }}>
      <SkeletonBlock width="100%" height={minHeight - 28} borderRadius={6} />
    </div>
  </div>
);

// ── Recent bookings table skeleton — 2 rows ───────────────────────────────────

const RecentBookingsTableSkeleton: React.FC = () => {
  const COLS = [140, 120, 95, 80, 100]; // Reference | Customer | Channel | Status | Date

  return (
    <div
      style={{
        background:    "var(--sc-card)",
        border:        "1px solid var(--sc-border)",
        borderRadius:  10,
        overflow:      "hidden",
        boxShadow:     "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Table section header */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "10px 14px",
          borderBottom:   "1px solid var(--sc-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SkeletonBlock width={130} height={13} borderRadius={3} />
          <SkeletonBlock width={115} height={11} borderRadius={3} />
        </div>
      </div>

      {/* Column header row */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          padding:      "7px 12px",
          background:   "var(--dt-header)",
          borderBottom: "1px solid var(--sc-border)",
          gap:          16,
        }}
      >
        {COLS.map((w, i) => (
          <SkeletonBlock key={i} width={w} height={10} borderRadius={3} />
        ))}
      </div>

      {/* 2 skeleton data rows */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display:      "flex",
            alignItems:   "center",
            padding:      "9px 12px",
            borderBottom: i === 0 ? "1px solid var(--sc-border)" : "none",
            gap:          16,
          }}
        >
          <SkeletonBlock width={130} height={15} borderRadius={3} />
          <SkeletonBlock width={110} height={13} borderRadius={3} />
          <SkeletonBlock width={68}  height={13} borderRadius={3} />
          <SkeletonBlock width={68}  height={20} borderRadius={99} />
          <SkeletonBlock width={88}  height={13} borderRadius={3} />
        </div>
      ))}
    </div>
  );
};

// ── DashboardSkeleton — full page ─────────────────────────────────────────────

export const DashboardSkeleton: React.FC = () => {
  const sidebarCollapsed = (() => {
    try { return localStorage.getItem("uttm_sidebar_collapsed_v4") === "true"; } catch { return false; }
  })();

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;

  return (
    <div
      className="dashboard-shell"
      style={{
        display:         "flex",
        gap:             isMobile ? 0 : 6,
        backgroundColor: "var(--sc-shell)",
        boxSizing:       "border-box",
        width:           "100%",
        overflow:        "hidden",
      }}
    >
      {/* Sidebar */}
      {!isMobile && <SidebarShellSkeleton collapsed={sidebarCollapsed} />}

      {/* Right panel */}
      <div
        style={{
          flex:          1,
          minWidth:      0,
          display:       "flex",
          flexDirection: "column",
          height:        "100%",
          overflow:      "hidden",
        }}
      >
        {/* Content card */}
        <div
          className="content-card"
          style={{
            flex:            1,
            display:         "flex",
            flexDirection:   "column",
            overflow:        "hidden",
            borderRadius:    8,
            backgroundColor: "var(--sc-card)",
            border:          "1px solid var(--sc-border)",
          }}
        >
          <TopBarShellSkeleton />

          {/* Scrollable main */}
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
            <div style={{ flex: 1, padding: 0, minHeight: "100%", boxSizing: "border-box" }}>

              {/* ── Dashboard content ───────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", background: "var(--dt-bg)" }}>

                {/* Page header strip */}
                <div
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    gap:            10,
                    padding:        "8px 14px",
                    borderBottom:   "1px solid var(--sc-border)",
                    flexShrink:     0,
                    background:     "var(--sc-card)",
                    flexWrap:       "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SkeletonBlock width={30} height={30} borderRadius={7} />
                    <div>
                      <SkeletonBlock width={130} height={14} borderRadius={3} style={{ marginBottom: 5 }} />
                      <SkeletonBlock width={200} height={11} borderRadius={3} />
                    </div>
                  </div>
                  <SkeletonBlock width={78} height={27} borderRadius={6} />
                </div>

                {/* Body — same classes as AdminDashboard */}
                <div className="dash-body">

                  {/* 6 KPI stat cards — 3-col → 2-col → 1-col */}
                  <div className="stat-grid stat-grid-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <StatCardSkeleton key={i} />
                    ))}
                  </div>

                  {/* Booking Trend line chart */}
                  <ChartCardSkeleton minHeight={210} />

                  {/* Booking Status + Bookings by Channel — fluid 2-col */}
                  <div className="chart-duo">
                    <ChartCardSkeleton minHeight={230} />
                    <ChartCardSkeleton minHeight={230} />
                  </div>

                  {/* Recent Bookings — 2 skeleton rows */}
                  <RecentBookingsTableSkeleton />
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
