import { useMemo } from "react";
import {
  LayoutDashboard,
  Settings,
  Users,
  Key,
  BookOpen,
  MessageSquare,
  PenTool,
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
      ...(hasAccess("booking_management")
        ? [{ name: "Booking Management", href: "/booking-management", icon: BookOpen }]
        : []),
    ];

    // Board is always visible — no auth check (public route)
    const tools: NavItemType[] = [
      { name: "Project Board", href: "/boards", icon: PenTool },
    ];

    const support: NavItemType[] = [
      { name: "Help Chat", href: "/help-chat", icon: MessageSquare },
    ];

    const config: NavItemType[] = [
      ...(settingsChildren.length > 0
        ? [{ name: "Settings & Config", icon: Settings, children: settingsChildren }]
        : []),
    ];

    return [
      ...dashboards,
      ...(operations.length > 0 ? [group("Operations"),    ...operations] : []),
      group("Tools"),           ...tools,
      ...(support.length    > 0 ? [group("Support"),       ...support]    : []),
      ...(config.length     > 0 ? [group("Configuration"), ...config]     : []),
    ];
  }, [accessData, roleName]);
};
