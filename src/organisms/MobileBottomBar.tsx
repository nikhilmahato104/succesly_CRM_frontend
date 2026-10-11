import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  LayoutDashboard, Plus, FolderKanban, Settings, Menu,
  Users, ShieldCheck, Boxes, Key, ChevronRight, type LucideIcon,
} from "lucide-react";
import { selectAccessData } from "../store/slices/accessSlice";
import { CleanModal } from "../atoms/my_clean_code_atoms";
import { emitNavStart } from "../atoms/NavigationProgress";

interface Props {
  onMenuOpen: () => void;
}

// Custom events — each page listens for its own event to open the create modal
export const OPEN_CREATE_USER_EVENT     = "uttm-open-create-user";
export const OPEN_CREATE_ROLE_EVENT     = "uttm-open-create-role";
export const OPEN_CREATE_APIKEY_EVENT   = "uttm-open-create-api-key";
export const OPEN_CREATE_MODULE_EVENT   = "uttm-open-create-module";

type NavTab = { icon: LucideIcon; label: string; href?: string; match?: string; onClick?: () => void };

type SettingsItem = { moduleId: string; label: string; description: string; href: string; icon: LucideIcon };

// Each entry mirrors a /setting-config route and the module key AppRoutes gates it on
const SETTINGS_ITEMS: SettingsItem[] = [
  { moduleId: "user_management",    label: "User Management",   description: "Create and manage users",       href: "/setting-config/user-management",    icon: Users },
  { moduleId: "role_management",    label: "Role Management",   description: "Roles and their permissions",   href: "/setting-config/role-management",    icon: ShieldCheck },
  { moduleId: "module_management",  label: "Module Management", description: "Modules available to roles",    href: "/setting-config/module-management",  icon: Boxes },
  { moduleId: "api_key_management", label: "API Keys",          description: "Generate and revoke API keys",  href: "/setting-config/api-key-management", icon: Key },
];

// ── Settings bottom sheet ───────────────────────────────────────────────────
const SettingsSheet: React.FC<{
  isOpen:   boolean;
  onClose:  () => void;
  items:    SettingsItem[];
  pathname: string;
  onSelect: (href: string) => void;
}> = ({ isOpen, onClose, items, pathname, onSelect }) => (
  <CleanModal
    mode="sheet"
    isOpen={isOpen}
    onClose={onClose}
    title="Settings & Config"
    expandable={false}
    closeOnBackdrop
  >
    <ul style={{ listStyle: "none", margin: 0, padding: "0 0 env(safe-area-inset-bottom)", display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(({ href, label, description, icon: Icon }) => {
        const active = pathname === href;
        return (
          <li key={href}>
            <button
              type="button"
              onClick={() => onSelect(href)}
              style={{
                width:          "100%",
                display:        "flex",
                alignItems:     "center",
                gap:            12,
                padding:        "12px 10px",
                borderRadius:   10,
                border:         "none",
                background:     active ? "var(--sb-hover)" : "transparent",
                cursor:         "pointer",
                textAlign:      "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{
                width:          36,
                height:         36,
                borderRadius:   10,
                flexShrink:     0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                background:     active ? "var(--primary)" : "var(--sb-hover)",
                color:          active ? "#ffffff" : "var(--fi-text)",
              }}>
                <Icon style={{ width: 18, height: 18 }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: active ? "var(--primary)" : "var(--fi-text)" }}>{label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--fi-muted)", marginTop: 2 }}>{description}</span>
              </span>
              <ChevronRight style={{ width: 16, height: 16, color: "var(--fi-muted)", flexShrink: 0 }} />
            </button>
          </li>
        );
      })}
    </ul>
  </CleanModal>
);

const MobileBottomBar: React.FC<Props> = ({ onMenuOpen }) => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const access       = useSelector((s: any) => selectAccessData(s));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsItems = useMemo(
    () => SETTINGS_ITEMS.filter(item => access?.[item.moduleId]?.view),
    [access],
  );

  const nav = useMemo<Array<NavTab | null>>(() => [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: FolderKanban,    label: "Projects",  href: "/projects" },
    null, // FAB slot
    ...(settingsItems.length > 0
      ? [{ icon: Settings, label: "Settings", match: "/setting-config", onClick: () => setSettingsOpen(true) }]
      : []),
    { icon: Menu,            label: "Menu",      onClick: onMenuOpen },
  ], [settingsItems, onMenuOpen]);

  const goToSetting = (href: string) => {
    setSettingsOpen(false);
    if (href === pathname) return;
    emitNavStart();
    navigate(href);
  };

  // ── Scroll-aware hide/show (YouTube style) ────────────────────────────────
  const [barHidden, setBarHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef        = useRef(0);

  useEffect(() => {
    const THRESHOLD = 6;

    const handler = (e: Event) => {
      const el = e.target as Element;
      const scrollY = (el as HTMLElement).scrollTop ?? 0;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const delta = scrollY - lastScrollYRef.current;
        if (Math.abs(delta) < THRESHOLD) return;
        setBarHidden(delta > 0);
        lastScrollYRef.current = scrollY;
      });
    };

    document.addEventListener("scroll", handler, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", handler, { capture: true } as EventListenerOptions);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isActive = (href?: string) =>
    href ? (href === "/" ? pathname === "/" : pathname.startsWith(href)) : false;

  // Route-aware FAB — null means hidden (no FAB rendered for that route)
  const fab = useMemo<{ label: string; action: () => void } | null>(() => {
    if (pathname.startsWith("/projects")) {
      return {
        label:  "New Project",
        action: () => navigate("/projects/new"),
      };
    }
    if (pathname === "/setting-config/user-management") {
      return {
        label:  "New User",
        action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_USER_EVENT)),
      };
    }
    if (pathname === "/setting-config/role-management") {
      return {
        label:  "New Role",
        action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_ROLE_EVENT)),
      };
    }
    if (pathname === "/setting-config/api-key-management") {
      return {
        label:  "New API Key",
        action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_APIKEY_EVENT)),
      };
    }
    if (pathname === "/setting-config/module-management") {
      return {
        label:  "New Module",
        action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_MODULE_EVENT)),
      };
    }
    // Other setting-config sub-pages — no relevant create action
    if (pathname.startsWith("/setting-config")) return null;
    // Default: show FAB that creates a project
    return {
      label:  "New Project",
      action: () => navigate("/projects/new"),
    };
  }, [pathname, navigate]);

  return (
    <>
      {/* ── Spacer so content is never hidden behind the bar ──────────── */}
      {/* handled by paddingBottom in DashboardLayout */}

      <div
        className="mobile-bottom-bar"
        style={{
          position:        "fixed",
          bottom:          0,
          left:            0,
          right:           0,
          zIndex:          700,
          background:      "var(--bottom-bar-bg)",
          backdropFilter:  "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          display:         "flex",
          alignItems:      "stretch",
          paddingBottom:   "env(safe-area-inset-bottom, 0px)",
          paddingLeft:     "env(safe-area-inset-left, 0px)",
          paddingRight:    "env(safe-area-inset-right, 0px)",
          WebkitTapHighlightColor: "transparent",
          transform:       barHidden ? "translateY(100%)" : "translateY(0)",
          transition:      "transform 300ms cubic-bezier(0.4,0,0.2,1)",
          willChange:      "transform",
        }}
      >
        {nav.map((item, i) => {
          /* ── Center FAB ─────────────────────────────────────────────── */
          if (item === null) {
            return (
              <div
                key="fab"
                style={{
                  flex:           1,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  paddingTop:     6,
                  paddingBottom:  6,
                }}
              >
                {fab && (
                  <button
                    onClick={fab.action}
                    aria-label={fab.label}
                    style={{
                      width:           52,
                      height:          52,
                      borderRadius:    "50%",
                      background:      "var(--primary)",
                      border:          "none",
                      cursor:          "pointer",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      boxShadow:       "0 4px 16px var(--primary-ring)",
                      transform:       "translateY(-10px)",
                      WebkitTapHighlightColor: "transparent",
                      transition:      "transform 120ms ease, box-shadow 120ms ease",
                      flexShrink:      0,
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-8px) scale(0.93)"; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-10px) scale(1)"; }}
                  >
                    <Plus style={{ width: 24, height: 24, color: "var(--primary-text)" }} />
                  </button>
                )}
              </div>
            );
          }

          /* ── Regular tab ────────────────────────────────────────────── */
          const active = settingsOpen ? item.label === "Settings" : isActive(item.match ?? item.href);
          const Icon   = item.icon;

          return (
            <button
              key={i}
              aria-label={item.label}
              onClick={() => item.onClick ? item.onClick() : item.href && navigate(item.href)}
              style={{
                flex:            1,
                display:         "flex",
                flexDirection:   "column",
                alignItems:      "center",
                justifyContent:  "center",
                gap:             3,
                padding:         "10px 0 8px",
                background:      "transparent",
                border:          "none",
                cursor:          "pointer",
                color:           active ? "var(--primary)" : "var(--sb-text-dim)",
                transition:      "color 140ms ease",
                WebkitTapHighlightColor: "transparent",
                minWidth:        0,
              }}
              onTouchStart={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--fi-text)";
              }}
              onTouchEnd={e => {
                (e.currentTarget as HTMLButtonElement).style.color = active ? "var(--primary)" : "var(--sb-text-dim)";
              }}
            >
              <Icon style={{ width: 22, height: 22, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, whiteSpace: "nowrap", lineHeight: 1 }}>
                {item.label}
              </span>
              {/* active dot */}
              {active && (
                <span style={{
                  position:     "absolute",
                  bottom:       "calc(2px + env(safe-area-inset-bottom))",
                  width:        4,
                  height:       4,
                  borderRadius: "50%",
                  background:   "var(--primary)",
                }} />
              )}
            </button>
          );
        })}
      </div>

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={settingsItems}
        pathname={pathname}
        onSelect={goToSetting}
      />
    </>
  );
};

export default MobileBottomBar;
