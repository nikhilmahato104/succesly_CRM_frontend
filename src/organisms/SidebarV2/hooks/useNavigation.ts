import { useMemo } from "react";
import {
  LayoutDashboard,
  Settings,
  Users,
  Key,
  FolderKanban,
  Activity,
  Smartphone,
  Link2,
  Construction,
  ImageDown,
} from "lucide-react";

import { NavItemType } from "../types";

const canView   = (a: Record<string, any> | null, key: string) => Boolean(a?.[key]?.view);
const canAccess = (a: Record<string, any> | null, key: string) => Boolean(a?.[key]?.view || a?.[key]?.edit);

const group = (name: string): NavItemType => ({ kind: "group", name });

function dashboardItems(roleName: string): NavItemType[] {
  const role = (roleName || "").toLowerCase();
  if (role.includes("super"))   return [{ name: "Admin Dashboard",   href: "/dashboard/admin",   icon: LayoutDashboard }];
  if (role.includes("manager")) return [{ name: "Manager Dashboard", href: "/dashboard/manager", icon: LayoutDashboard }];
  return [];
}

export const useNavigation = (
  accessData: Record<string, any> | null,
  roleName:   string,
): NavItemType[] => {
  return useMemo(() => {
    const has       = (key: string) => canView(accessData, key);
    const hasAccess = (key: string) => canAccess(accessData, key);

    const hasUrm =
      hasAccess("urm_management") ||
      hasAccess("user_management") ||
      hasAccess("role_management") ||
      hasAccess("module_management");

    const settingsChildren: NavItemType[] = [
      ...(hasUrm
        ? [{ name: "URM Management", href: "/setting-config/user-management", icon: Users }]
        : []),
      ...(hasAccess("api_key_management")
        ? [{ name: "API Key Management", href: "/setting-config/api-key-management", icon: Key }]
        : []),
    ];

    // Legacy access-key dashboards (kept for backward compat, hidden when keys absent)
    const legacyDashboards: NavItemType[] = [
      ...(has("data-dashboard")           ? [{ name: "Dashboard", href: "/dashboard-admin",          icon: LayoutDashboard }] : []),
      ...(has("dashboard-tso")            ? [{ name: "Dashboard", href: "/dashboard-tso",            icon: LayoutDashboard }] : []),
      ...(has("dashboard-manager")        ? [{ name: "Dashboard", href: "/dashboard-manager",        icon: LayoutDashboard }] : []),
      ...(has("dashboard-branch-manager") ? [{ name: "Dashboard", href: "/dashboard-branch-manager", icon: LayoutDashboard }] : []),
      ...(has("dashboard-team-leader")    ? [{ name: "Dashboard", href: "/dashboard-team-leader",    icon: LayoutDashboard }] : []),
    ];

    const dashboards: NavItemType[] = [...legacyDashboards, ...dashboardItems(roleName)];

    const operations: NavItemType[] = [
      ...(hasAccess("device_info")
        ? [{ name: "Device Info", href: "/device-info", icon: Smartphone }]
        : []),
      ...(hasAccess("project_management")
        ? [{ name: "Project Management", href: "/projects", icon: FolderKanban }]
        : []),
      ...(hasAccess("campaign_and_short_url_management")
        ? [{ name: "Campaigns & Short Links", href: "/campaigns", icon: Link2 }]
        : []),
      ...(hasAccess("site_maintenance")
        ? [{ name: "Site Maintenance", href: "/site-maintenance", icon: Construction }]
        : []),
      ...(hasAccess("activity_log")
        ? [{ name: "Activity Logs", href: "/activity-logs", icon: Activity }]
        : []),
    ];

    const config: NavItemType[] = [
      ...(settingsChildren.length > 0
        ? [{ name: "Settings & Config", icon: Settings, children: settingsChildren }]
        : []),
    ];

    // Browser-only tools — no module permission, available to every signed-in user
    const tools: NavItemType[] = [
      { name: "Image to WebP", href: "/tools/image-converter", icon: ImageDown },
    ];

    return [
      ...dashboards,
      ...(operations.length > 0 ? [group("Operations"),    ...operations] : []),
      group("Tools"), ...tools,
      ...(config.length     > 0 ? [group("Configuration"), ...config]     : []),
    ];
  }, [accessData, roleName]);
};
