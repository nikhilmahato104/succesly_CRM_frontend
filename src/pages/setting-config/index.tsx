/**
 * SettingConfig — tab container for User / Role / Module management.
 *
 * OPTIMIZATION — CSS mount preservation:
 * ─────────────────────────────────────────────────────────────────
 * All three tab components are ALWAYS mounted. Inactive tabs are hidden
 * with `display: none` (not unmounted). This means:
 *
 *   • Zero remount cost when switching tabs.
 *   • React state (data, pagination, search) is preserved across switches.
 *   • useEffect hooks do NOT re-run — no redundant API calls.
 *   • On first visit to each tab → 1 API call (unavoidable).
 *   • On subsequent visits     → 0 API calls (state still in memory).
 *
 * Combined with queryCache.ts (SWR + in-flight dedup), even a forced
 * refresh shares a single in-flight Promise across concurrent callers.
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Settings } from "lucide-react";
import { useSelector } from "react-redux";
import { selectAccessData } from "../../store/slices/accessSlice";
import UserManagementList from "../user-management/UserManagementList";
import RoleManagement     from "../user-management/RoleManagement";
import ModuleManagement   from "./ModuleManagement";

// ── Tabs config ────────────────────────────────────────────────────────────────

const TABS = [
  { label: "User Management",   path: "/setting-config/user-management",   moduleKey: "user_management"   },
  { label: "Role Management",   path: "/setting-config/role-management",   moduleKey: "role_management"   },
  { label: "Module Management", path: "/setting-config/module-management", moduleKey: "module_management" },
] as const;

type TabLabel = typeof TABS[number]["label"];

function getActiveLabel(pathname: string): TabLabel {
  if (pathname.includes("role-management"))   return "Role Management";
  if (pathname.includes("module-management")) return "Module Management";
  return "User Management";
}

// ── Panel wrapper — always rendered, hidden via CSS when inactive ──────────────

interface PanelProps { active: boolean; children: React.ReactNode }

const TabPanel: React.FC<PanelProps> = ({ active, children }) => (
  <div
    style={{
      // position:absolute + inset:0 makes the panel fill the parent container.
      // All three panels stack on top of each other; only the active one is visible.
      position:      "absolute",
      inset:         0,
      display:       active ? "flex" : "none",
      flexDirection: "column",
      overflow:      "hidden",
    }}
  >
    {children}
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────────

const SettingConfig: React.FC = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const access       = useSelector(selectAccessData) as Record<string, { view?: boolean; edit?: boolean }> | null;

  const activeLabel = getActiveLabel(pathname);

  const visibleTabs = TABS.filter((t) =>
    Boolean(access?.[t.moduleKey]?.view || access?.[t.moduleKey]?.edit)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--sc-border)",
        flexShrink: 0, background: "var(--sc-card)", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "rgba(99,102,241,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1",
          }}>
            <Settings size={15} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--dt-text)", lineHeight: 1.2 }}>
              {activeLabel}
            </div>
            <div style={{ fontSize: 11, color: "var(--dt-muted)" }}>
              Manage {activeLabel.toLowerCase()} and configurations
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 2,
        padding: "0 14px", borderBottom: "1px solid var(--sc-border)",
        background: "var(--sc-card)", flexShrink: 0,
      }}>
        {visibleTabs.map((tab) => {
          const isActive = activeLabel === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              style={{
                padding: "8px 14px", fontSize: 13, fontWeight: isActive ? 600 : 400,
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--btn-primary-bg)" : "2px solid transparent",
                color: isActive ? "var(--btn-primary-bg)" : "var(--dt-muted)",
                transition: "color 140ms ease, border-color 140ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content — all panels always mounted ─────────────────────────── */}
      {/*
        The position:relative container defines the shared bounding box.
        Each TabPanel is position:absolute filling the entire container.
        Only the active panel has display:flex; others are display:none.
        React keeps all three component trees alive → zero remount on tab switch.
      */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <TabPanel active={activeLabel === "User Management"}>
          <UserManagementList />
        </TabPanel>
        <TabPanel active={activeLabel === "Role Management"}>
          <RoleManagement />
        </TabPanel>
        <TabPanel active={activeLabel === "Module Management"}>
          <ModuleManagement />
        </TabPanel>
      </div>
    </div>
  );
};

export default SettingConfig;
