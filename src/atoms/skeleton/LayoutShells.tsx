/**
 * LayoutShells.tsx — shared skeleton chrome for sidebar + topbar.
 * Used by both DashboardSkeleton and BookingManagementSkeleton.
 * Mirrors the exact pixel dimensions and CSS variables of DashboardLayout.
 */
import React from "react";
import { SkeletonBlock } from "./SkeletonBlock";

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarShellSkeletonProps {
  collapsed?: boolean;
}

export const SidebarShellSkeleton: React.FC<SidebarShellSkeletonProps> = ({
  collapsed = false,
}) => {
  const W = collapsed ? 64 : 260;

  return (
    <div
      style={{
        width:           W,
        flexShrink:      0,
        backgroundColor: "var(--sb-bg)",
        borderRadius:    8,
        border:          "1px solid var(--sb-border)",
        display:         "flex",
        flexDirection:   "column",
        overflow:        "hidden",
        transition:      "width 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Logo row — height matches real sidebar header */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          height:         52,
          padding:        "0 14px",
          borderBottom:   "1px solid var(--sb-border)",
          flexShrink:     0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <SkeletonBlock width={28} height={28} borderRadius={7} />
          {!collapsed && <SkeletonBlock width={72} height={12} borderRadius={3} />}
        </div>
        <SkeletonBlock width={20} height={20} borderRadius={5} />
      </div>

      {/* Nav items */}
      <div
        style={{
          flex:          1,
          padding:       "10px 8px",
          display:       "flex",
          flexDirection: "column",
          gap:           3,
          overflow:      "hidden",
        }}
      >
        {/* Active nav item */}
        <SkeletonBlock width="100%" height={34} borderRadius={7} />

        {!collapsed && (
          <>
            {/* OPERATIONS section */}
            <div style={{ padding: "8px 8px 4px", marginTop: 4 }}>
              <SkeletonBlock width={78} height={9} borderRadius={3} />
            </div>
            <SkeletonBlock width="100%" height={34} borderRadius={7} />

            {/* SUPPORT section */}
            <div style={{ padding: "8px 8px 4px", marginTop: 4 }}>
              <SkeletonBlock width={58} height={9} borderRadius={3} />
            </div>
            <SkeletonBlock width="100%" height={34} borderRadius={7} />

            {/* CONFIGURATION section */}
            <div style={{ padding: "8px 8px 4px", marginTop: 4 }}>
              <SkeletonBlock width={96} height={9} borderRadius={3} />
            </div>
            <SkeletonBlock width="100%" height={34} borderRadius={7} />
          </>
        )}
      </div>

      {/* User profile row */}
      <div
        style={{
          padding:     "10px 12px",
          borderTop:   "1px solid var(--sb-border)",
          display:     "flex",
          alignItems:  "center",
          gap:         9,
          flexShrink:  0,
        }}
      >
        <SkeletonBlock width={30} height={30} borderRadius={99} circle />
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBlock width="65%" height={11} borderRadius={3} style={{ marginBottom: 5 }} />
            <SkeletonBlock width="42%" height={9}  borderRadius={3} />
          </div>
        )}
        {!collapsed && <SkeletonBlock width={12} height={12} borderRadius={3} />}
      </div>
    </div>
  );
};

// ── TopBar ────────────────────────────────────────────────────────────────────

export const TopBarShellSkeleton: React.FC = () => (
  <div
    style={{
      flexShrink:      0,
      display:         "flex",
      alignItems:      "center",
      height:          42,
      padding:         "0 12px",
      borderBottom:    "1px solid var(--sc-border)",
      backgroundColor: "var(--sc-card)",
      gap:             10,
      boxSizing:       "border-box",
    }}
  >
    {/* Workspace identity: logo + name + chevron */}
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
      <SkeletonBlock width={24} height={24} borderRadius={6} />
      <SkeletonBlock width={65} height={12} borderRadius={3} />
      <SkeletonBlock width={10} height={10} borderRadius={99} />
    </div>

    {/* Divider */}
    <div style={{ width: 1, height: 18, background: "var(--sc-border)", flexShrink: 0 }} />

    {/* Global search */}
    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
      <SkeletonBlock
        width="min(340px, 100%)"
        height={28}
        borderRadius={7}
      />
    </div>

    {/* Right actions: bell + settings + divider + avatar */}
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <SkeletonBlock width={30} height={30} borderRadius={6} />
      <SkeletonBlock width={30} height={30} borderRadius={6} />
      <div style={{ width: 1, height: 18, background: "var(--sc-border)", margin: "0 2px", flexShrink: 0 }} />
      <SkeletonBlock width={44} height={30} borderRadius={7} />
    </div>
  </div>
);
