//V5
import React from "react";
import { Drawer } from "vaul";
import { ShieldCheck, X } from "lucide-react";
import { AnimatedContent } from "../../atoms/reactbits";

type RoleAccess = {
  module_id: string;
  create?: boolean;
  edit?: boolean;
  view?: boolean;
  delete?: boolean;
  transfer?: boolean;
  export?: boolean;
};

const MODULE_LABEL: Record<string, string> = {
  "data-dashboard": "Dashboard Admin",
  "admin-dashboard": "Admin Dashboard",
  settings: "Settings",
  "user-management": "User Management",
  "dashboard-branch-manager": "Dashboard Branch Manager",
  "dashboard-team-leader": "Dashboard Team Lead",
  "dashboard-tso": "Dashboard TSO",
  "dashboard-manager": "Dashboard Manager",
  "customer-master": "Customer Master",
  "employee-management": "Employee Management",
  "loan-evaluator": "Business Rule Engine",
  "lead-management": "Lead Management",
  "activity-tracker-management": "Activity Tracker",
  "master-configuration": "Master Configuration",
  "rules-management": "Product Rules",
  "support-ticket": "Support Ticket",
  banks: "Banks",
  products: "Products",
  companies: "Companies",
  cities: "Cities",
  "company-categories": "Company Categories",
};

const PERM_KEYS: (keyof RoleAccess)[] = [
  "create", "edit", "view", "delete", "transfer", "export",
];
const PERM_LABELS = ["Create", "Edit", "View", "Delete", "Transfer", "Export"];

const PARTIAL_SNAP = 0.68; // ≈ 65dvh of the sheet visible
const FULL_SNAP    = 1;
const SNAP_POINTS  = [PARTIAL_SNAP, FULL_SNAP];

// ─── Permissions Table ─────────────────────────────────────────────────────
const PermissionsTable: React.FC<{ access: RoleAccess[] }> = ({ access }) => (
  <div className="overflow-auto">
    <table className="w-full min-w-[440px]">
      <thead>
        <tr>
          <th
            className="sticky top-0 z-10 text-left px-4 py-3
              text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide
              bg-gray-50 dark:bg-gray-800/80
              border-b border-gray-200 dark:border-gray-700"
            style={{ fontSize: "clamp(0.85rem, 2vw, 0.95rem)" }}
          >
            Module
          </th>
          {PERM_LABELS.map((l) => (
            <th
              key={l}
              className="sticky top-0 z-10 text-center px-2 py-3
                text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap
                bg-gray-50 dark:bg-gray-800/80
                border-b border-gray-200 dark:border-gray-700"
              style={{ fontSize: "clamp(0.85rem, 2vw, 0.95rem)" }}
            >
              {l}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {access.map((ra, i) => (
          <tr
            key={ra.module_id + i}
            className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
          >
            <td
              className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap"
              style={{ fontSize: "clamp(1rem, 2.5vw, 1.15rem)" }}
            >
              {MODULE_LABEL[ra.module_id] ?? ra.module_id}
            </td>
            {PERM_KEYS.map((key) => {
              const on = !!ra[key];
              return (
                <td key={String(key)} className="px-2 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center rounded-full font-bold
                      ${on
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
                      }`}
                    style={{
                      width: "1.8rem",
                      height: "1.8rem",
                      fontSize: "clamp(0.8rem, 1.8vw, 0.9rem)",
                    }}
                  >
                    {on ? "✓" : "–"}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Bottom Sheet (vaul) ───────────────────────────────────────────────────
// Opens at ~65% height; swipe up → full height, swipe down → dismiss.
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  access: RoleAccess[];
}

const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, access }) => {
  const [snap, setSnap] = React.useState<number | string | null>(PARTIAL_SNAP);

  React.useEffect(() => { if (open) setSnap(PARTIAL_SNAP); }, [open]);

  const atPartial = snap !== FULL_SNAP;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      fadeFromIndex={0}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: 9998, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        />
        <Drawer.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: "97dvh",
            borderRadius: "20px 20px 0 0",
            display: "flex",
            flexDirection: "column",
            outline: "none",
          }}
          className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl"
        >
        {/* Drag Handle — tap to toggle partial ↔ full */}
        <div className="pt-3 pb-2 flex-shrink-0">
          <Drawer.Handle className="!w-10 !h-1 !bg-gray-300 dark:!bg-gray-600" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pb-4 flex-shrink-0
            border-b border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <Drawer.Title
                className="font-semibold text-gray-900 dark:text-white leading-tight"
                style={{ fontSize: "clamp(1.2rem, 3vw, 1.4rem)" }}
              >
                Permissions Overview
              </Drawer.Title>
              <p
                className="text-gray-400 dark:text-gray-500 leading-tight mt-0.5"
                style={{ fontSize: "clamp(1rem, 2.2vw, 1.1rem)" }}
              >
                {access.length} {access.length === 1 ? "module" : "modules"} configured
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center
              bg-gray-100 dark:bg-gray-800
              text-gray-500 dark:text-gray-400
              hover:bg-gray-200 dark:hover:bg-gray-700
              active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content — at the partial snap the lower part of the
            sheet is off-screen, so pad the end to keep the last rows reachable */}
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
          <AnimatedContent distance={18} delay={0.08}>
            <PermissionsTable access={access} />
          </AnimatedContent>
          <div style={{ height: atPartial ? `calc(24px + ${(1 - PARTIAL_SNAP) * 100}dvh)` : 24 }} />
        </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

// ─── Trigger Badge ─────────────────────────────────────────────────────────
interface ActionSetBadgeProps {
  access: RoleAccess[];
}

export const ActionSetBadge: React.FC<ActionSetBadgeProps> = ({ access }) => {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className="inline-flex items-center gap-1.5 select-none
          rounded-full border px-2.5 py-1 text-xs font-medium
          bg-indigo-50 border-indigo-200 text-indigo-700
          dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300
          hover:bg-indigo-100 hover:border-indigo-300
          dark:hover:bg-indigo-900/60 dark:hover:border-indigo-700
          active:scale-95 transition-all duration-150"
      >
        <ShieldCheck className="w-3 h-3 flex-shrink-0" />
        {access.length} {access.length === 1 ? "module" : "modules"}
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        access={access}
      />
    </>
  );
};

export default BottomSheet;
