/**
 * SettingConfigSkeleton.tsx — full-page skeletons for setting-config routes.
 *   SettingConfigSkeleton  → /setting-config/user|role|module-management
 *   ApiKeyPageSkeleton     → /setting-config/api-key-management
 * Both mirror DashboardLayout chrome + exact page header + toolbar + table.
 */
import React from "react";
import { SkeletonBlock } from "./SkeletonBlock";
import { SidebarShellSkeleton, TopBarShellSkeleton } from "./LayoutShells";

// ── Shared: full-page shell ────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sidebarCollapsed = (() => {
    try { return localStorage.getItem("uttm_sidebar_collapsed_v4") === "true"; } catch { return false; }
  })();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

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
      {!isMobile && <SidebarShellSkeleton collapsed={sidebarCollapsed} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
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
          {children}
        </div>
      </div>
    </div>
  );
};

// ── Shared: page header (icon + title + subtitle) ─────────────────────────────

const PageHeaderSkeleton: React.FC<{ titleW: number; subtitleW: number }> = ({ titleW, subtitleW }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 14px", borderBottom: "1px solid var(--sc-border)",
    flexShrink: 0, background: "var(--sc-card)",
  }}>
    <SkeletonBlock width={30} height={30} borderRadius={7} />
    <div>
      <SkeletonBlock width={titleW}    height={13} borderRadius={3} style={{ marginBottom: 5 }} />
      <SkeletonBlock width={subtitleW} height={10} borderRadius={3} />
    </div>
  </div>
);

// ── Shared: toolbar (search + filter + spacer + create) ────────────────────────

const ConfigToolbarSkeleton: React.FC<{ createBtnW?: number }> = ({ createBtnW = 110 }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 12px", borderBottom: "1px solid var(--fi-border)",
    flexShrink: 0, flexWrap: "wrap", background: "var(--fi-bg)",
  }}>
    <SkeletonBlock width={260} height={30} borderRadius={7} />
    <SkeletonBlock width={76}  height={30} borderRadius={7} />
    <div style={{ flex: 1 }} />
    <SkeletonBlock width={createBtnW} height={30} borderRadius={7} />
  </div>
);

// ── Shared: table (header + N data rows) ──────────────────────────────────────

type ColKind = "text" | "badge";

interface ColDef { w: number; kind?: ColKind }

const TableSkeletonShared: React.FC<{ cols: ColDef[]; rows?: number }> = ({ cols, rows = 3 }) => (
  <div style={{ flex: 1, overflowX: "auto" }}>
    {/* Column headers */}
    <div style={{
      display: "flex", alignItems: "center", padding: "8px 12px",
      background: "var(--dt-header)", borderBottom: "1px solid var(--sc-border)",
      gap: 12, minWidth: "max-content",
    }}>
      <SkeletonBlock width={16} height={16} borderRadius={4} style={{ flexShrink: 0 }} />
      {cols.map((c, i) => (
        <SkeletonBlock key={i} width={c.w} height={10} borderRadius={3} style={{ flexShrink: 0 }} />
      ))}
      <div style={{ flex: 1 }} />
      <SkeletonBlock width={32} height={10} borderRadius={3} style={{ flexShrink: 0 }} />
    </div>

    {/* Data rows */}
    {Array.from({ length: rows }).map((_, ri) => (
      <div key={ri} style={{
        display: "flex", alignItems: "center", padding: "10px 12px",
        borderBottom: "1px solid var(--sc-border)", gap: 12, minWidth: "max-content",
      }}>
        <SkeletonBlock width={16} height={16} borderRadius={4} style={{ flexShrink: 0 }} />
        {cols.map((c, i) => (
          <SkeletonBlock
            key={i}
            width={c.w}
            height={c.kind === "badge" ? 22 : 13}
            borderRadius={c.kind === "badge" ? 99 : 3}
            style={{ flexShrink: 0 }}
          />
        ))}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <SkeletonBlock width={24} height={24} borderRadius={5} style={{ flexShrink: 0 }} />
        </div>
      </div>
    ))}
  </div>
);

// ── SettingConfigSkeleton ──────────────────────────────────────────────────────

const SETTING_TABS = [
  { label: "User Management",   slug: "user-management"   },
  { label: "Role Management",   slug: "role-management"   },
  { label: "Module Management", slug: "module-management" },
];

// Mirrors UserManagementList columns
const USER_COLS: ColDef[] = [
  { w: 180 },           // User Name
  { w: 220 },           // Email
  { w: 150 },           // Role
  { w: 120, kind: "badge" }, // Status
];

export const SettingConfigSkeleton: React.FC = () => {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <PageShell>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

        <PageHeaderSkeleton titleW={140} subtitleW={240} />

        {/* Tab bar — highlight the active tab based on current URL */}
        <div style={{
          display: "flex", gap: 2, padding: "0 14px",
          borderBottom: "1px solid var(--sc-border)",
          background: "var(--sc-card)", flexShrink: 0,
        }}>
          {SETTING_TABS.map((tab) => {
            const isActive = pathname.includes(tab.slug);
            return (
              <div
                key={tab.slug}
                style={{
                  padding:      "9px 14px",
                  borderBottom: isActive
                    ? "2px solid var(--btn-primary-bg)"
                    : "2px solid transparent",
                }}
              >
                <SkeletonBlock
                  width={tab.label.length * 7}
                  height={11}
                  borderRadius={3}
                />
              </div>
            );
          })}
        </div>

        {/* Toolbar + table */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <ConfigToolbarSkeleton createBtnW={104} />
          <TableSkeletonShared cols={USER_COLS} />
        </div>
      </div>
    </PageShell>
  );
};

// ── ApiKeyPageSkeleton ─────────────────────────────────────────────────────────

// Mirrors ApiKeyManagement columns
const APIKEY_COLS: ColDef[] = [
  { w: 200 },                // Name
  { w: 120, kind: "badge" }, // Status
  { w: 130 },                // Usage
  { w: 140 },                // Expires
  { w: 140 },                // Created
];

export const ApiKeyPageSkeleton: React.FC = () => (
  <PageShell>
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

      <PageHeaderSkeleton titleW={160} subtitleW={280} />

      {/* Toolbar + table — no tab bar */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <ConfigToolbarSkeleton createBtnW={114} />
        <TableSkeletonShared cols={APIKEY_COLS} />
      </div>
    </div>
  </PageShell>
);
