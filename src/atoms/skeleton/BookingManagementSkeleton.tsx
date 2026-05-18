/**
 * BookingManagementSkeleton.tsx — full-page skeleton for /booking-management.
 * Mirrors DashboardLayout chrome + BookingManagement toolbar + 2-row table grid.
 */
import React from "react";
import { SkeletonBlock } from "./SkeletonBlock";
import { SidebarShellSkeleton, TopBarShellSkeleton } from "./LayoutShells";

// ── Toolbar skeleton — mirrors BookingManagement toolbar exactly ───────────────

const ToolbarSkeleton: React.FC = () => (
  <div
    style={{
      display:      "flex",
      alignItems:   "center",
      gap:          6,
      padding:      "7px 12px",
      borderBottom: "1px solid var(--fi-border)",
      flexShrink:   0,
      flexWrap:     "wrap",
      background:   "var(--fi-bg)",
    }}
  >
    {/* Search bar */}
    <SkeletonBlock width={230} height={30} borderRadius={7} />
    {/* Date range button */}
    <SkeletonBlock width={110} height={30} borderRadius={7} />
    {/* Filter button */}
    <SkeletonBlock width={76}  height={30} borderRadius={7} />
    {/* Export button */}
    <SkeletonBlock width={80}  height={30} borderRadius={7} />
    {/* Spacer pushes create button to the right */}
    <div style={{ flex: 1 }} />
    {/* Create Booking button */}
    <SkeletonBlock width={126} height={30} borderRadius={7} />
  </div>
);

// ── Table skeleton — column header + 2 data rows ──────────────────────────────

const TableSkeleton: React.FC = () => {
  // Column widths mirror COLUMNS definition in BookingManagement.tsx
  const HEADER_COLS  = [140, 160, 180, 110, 90, 130, 110]; // 7 data columns
  const ROW_WIDTHS   = [140, 160, 180, 110, 90, 130, 110];

  return (
    <div style={{ flex: 1, overflowX: "auto" }}>
      {/* Column header row */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          padding:      "8px 12px",
          background:   "var(--dt-header)",
          borderBottom: "1px solid var(--sc-border)",
          gap:          12,
          minWidth:     "max-content",
        }}
      >
        {/* Checkbox column */}
        <SkeletonBlock width={16} height={16} borderRadius={4} style={{ flexShrink: 0 }} />
        {HEADER_COLS.map((w, i) => (
          <SkeletonBlock key={i} width={w} height={10} borderRadius={3} style={{ flexShrink: 0 }} />
        ))}
        {/* Actions column header */}
        <div style={{ flex: 1 }} />
        <SkeletonBlock width={28} height={10} borderRadius={3} style={{ flexShrink: 0 }} />
      </div>

      {/* 2 skeleton data rows */}
      {[0, 1].map((rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display:      "flex",
            alignItems:   "center",
            padding:      "10px 12px",
            borderBottom: "1px solid var(--sc-border)",
            gap:          12,
            minWidth:     "max-content",
          }}
        >
          {/* Checkbox */}
          <SkeletonBlock width={16} height={16} borderRadius={4} style={{ flexShrink: 0 }} />

          {/* Reference ID — monospace chip style */}
          <SkeletonBlock width={ROW_WIDTHS[0]} height={22} borderRadius={5} style={{ flexShrink: 0 }} />

          {/* Customer — 2-line cell */}
          <div style={{ width: ROW_WIDTHS[1], flexShrink: 0 }}>
            <SkeletonBlock width="82%" height={13} borderRadius={3} style={{ marginBottom: 5 }} />
            <SkeletonBlock width="60%" height={11} borderRadius={3} />
          </div>

          {/* Address */}
          <SkeletonBlock width={ROW_WIDTHS[2]} height={13} borderRadius={3} style={{ flexShrink: 0 }} />

          {/* Branch */}
          <SkeletonBlock width={ROW_WIDTHS[3]} height={13} borderRadius={3} style={{ flexShrink: 0 }} />

          {/* Via badge */}
          <SkeletonBlock width={ROW_WIDTHS[4]} height={22} borderRadius={99} style={{ flexShrink: 0 }} />

          {/* Status badge */}
          <SkeletonBlock width={ROW_WIDTHS[5]} height={22} borderRadius={99} style={{ flexShrink: 0 }} />

          {/* Created date */}
          <SkeletonBlock width={ROW_WIDTHS[6]} height={13} borderRadius={3} style={{ flexShrink: 0 }} />

          {/* Row action icon */}
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            <SkeletonBlock width={24} height={24} borderRadius={5} style={{ flexShrink: 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── BookingManagementSkeleton — full page ─────────────────────────────────────

export const BookingManagementSkeleton: React.FC = () => {
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

          {/* Booking management body — same structure as real page */}
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              height:        "100%",
              overflow:      "hidden",
              background:    "var(--dt-bg)",
            }}
          >
            <ToolbarSkeleton />
            <TableSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
};
