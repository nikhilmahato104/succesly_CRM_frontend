import React from "react";
import RoleManagement from "./RoleManagement";
import UserManagementList from "./UserManagementList";
import { ClipboardCheck } from "lucide-react";
import { COLORS } from "../../theme/colors";
const TABS = ["User Management", "Role Management"] as const;
type Tab = typeof TABS[number];
const Tabs: React.FC<{
  active: Tab;
  onChange: (t: Tab) => void;
}> = ({ active, onChange }) => (
  <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-4">
    {TABS.map((t) => {
      const isActive = active === t;

      const activeStyle: React.CSSProperties & Record<string, string> | undefined =
        isActive
          ? {
              "--primary": COLORS.primary.DEFAULT,
              "--primary-hover": COLORS.primary.hover,
              "--primary-active": COLORS.primary.active,
            }
          : undefined;

      return (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={activeStyle}
          className={
            isActive
              ? "px-4 py-2 text-sm font-semibold border-b-2 border-[var(--primary)] text-[var(--primary)]"
              : "px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          }
        >
          {t}
        </button>
      );
    })}
  </div>
);

const UserManagement: React.FC = () => {
  const [active, setActive] = React.useState<Tab>("User Management");

  return (
    <div className="globalPadding">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-2 rounded-lg bg-[var(--primary-light)]">
          <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {active}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your {active} and configurations
          </p>
        </div>
      </div>
      <Tabs active={active} onChange={setActive} />
      {active === "Role Management" && <RoleManagement />}
      {active === "User Management" && <UserManagementList />}
    </div>
  );
};

export default UserManagement;