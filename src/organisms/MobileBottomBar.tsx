import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Plus, Settings, Menu,
  Users, ShieldCheck, Boxes, Key, ChevronRight, type LucideIcon,
} from "lucide-react";
import { selectAccessData } from "../store/slices/accessSlice";
import { selectUserData } from "../store/slices/userSlice";
import { useNavigation } from "./SidebarV2/hooks/useNavigation";
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

type NavTab = { key: string; icon: LucideIcon; label: string; href?: string; match?: string; onClick?: () => void };

// Bottom-bar labels must fit ~68px — sidebar names are too long
const SHORT_LABEL: Record<string, string> = {
  "/dashboard/admin":   "Dashboard",
  "/dashboard/manager": "Dashboard",
  "/device-info":       "Devices",
  "/projects":          "Projects",
  "/campaigns":         "Campaigns",
  "/site-maintenance":  "Sites",
  "/activity-logs":     "Logs",
};

const TAB_WIDTH  = 40;   // min width of an icon tab — tabs grow to fill each side
const FAB_SIZE   = 58;
const FAB_SLOT   = 72;   // centre gap reserved for the raised + button
const ISLAND_GAP = 10;   // space between the floating bar and the screen edges
const EDGE_FADE  = "linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)";

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
                borderRadius:   "var(--radius)",
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
                borderRadius:   "var(--radius)",
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

// ── One side of the island: icon tabs, active one shows a pill + label ──────
const TabStrip: React.FC<{
  tabs:      NavTab[];
  activeKey: string | null;
  tabRefs:   React.MutableRefObject<Map<string, HTMLButtonElement>>;
  onOpen:    (tab: NavTab) => void;
}> = ({ tabs, activeKey, tabRefs, onOpen }) => (
  <div
    className="bb-strip"
    style={{
      flex:            1,
      minWidth:        0,
      display:         "flex",
      justifyContent:  "space-around",
      alignItems:      "stretch",
      overflowX:       "auto",
      overflowY:       "hidden",
      scrollbarWidth:  "none",
      // Only visible if a role has more tabs than fit — hints there is more
      maskImage:       EDGE_FADE,
      WebkitMaskImage: EDGE_FADE,
      padding:         "0 2px",
    }}
  >
    {tabs.map(tab => {
      const active = tab.key === activeKey;
      const Icon   = tab.icon;
      return (
        <button
          key={tab.key}
          ref={el => { if (el) tabRefs.current.set(tab.key, el); else tabRefs.current.delete(tab.key); }}
          aria-label={tab.label}
          aria-current={active ? "page" : undefined}
          onClick={() => onOpen(tab)}
          style={{
            flex:           `1 0 ${TAB_WIDTH}px`,
            position:       "relative",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            3,
            padding:        0,
            background:     "transparent",
            border:         "none",
            cursor:         "pointer",
            color:          active ? "var(--primary)" : "var(--sb-text-dim)",
            transition:     "color 180ms ease",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            width:          active ? 44 : 36,
            height:         active ? 28 : 32,
            borderRadius:   99,
            background:     active ? "var(--primary-light)" : "transparent",
            transition:     "all 220ms cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <Icon style={{ width: 21, height: 21, flexShrink: 0, strokeWidth: active ? 2.3 : 1.9 }} />
          </span>
          {/* Label only under the active tab — keeps the island clean */}
          <span style={{
            fontSize:   10,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: "nowrap",
            maxHeight:  active ? 12 : 0,
            opacity:    active ? 1 : 0,
            overflow:   "visible",
            transition: "opacity 180ms ease, max-height 220ms ease",
          }}>
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);

const MobileBottomBar: React.FC<Props> = ({ onMenuOpen }) => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const access       = useSelector((s: any) => selectAccessData(s));
  const userData     = useSelector(selectUserData);
  const sidebarNav   = useNavigation(access, userData?.role_name || "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsItems = useMemo(
    () => SETTINGS_ITEMS.filter(item => access?.[item.moduleId]?.view),
    [access],
  );

  // Every page the user can open, in sidebar order: dashboard, operations, settings
  const tabs = useMemo<NavTab[]>(() => {
    const out: NavTab[] = [];
    for (const item of sidebarNav) {
      if (item.kind === "group" || !item.href || !item.icon) continue;   // section headers, Settings group
      out.push({
        key:   item.href,
        icon:  item.icon as LucideIcon,
        label: SHORT_LABEL[item.href] ?? item.name.split(" ")[0],
        href:  item.href,
      });
    }
    if (settingsItems.length > 0) {
      out.push({ key: "settings", icon: Settings, label: "Settings", match: "/setting-config", onClick: () => setSettingsOpen(true) });
    }
    return out;
  }, [sidebarNav, settingsItems]);

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

  const activeKey = settingsOpen
    ? "settings"
    : tabs.find(t => isActive(t.match ?? t.href))?.key ?? null;

  // Glide the active tab to the middle of the strip on every route change / swipe
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const tab   = activeKey ? tabRefs.current.get(activeKey) : undefined;
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: tab.offsetLeft - strip.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2, behavior: "smooth" });
  }, [activeKey, tabs.length]);

  // Tabs + Menu split around the centre + button
  const allTabs = useMemo<NavTab[]>(
    () => [...tabs, { key: "menu", icon: Menu, label: "Menu", onClick: onMenuOpen }],
    [tabs, onMenuOpen],
  );
  const half      = Math.ceil(allTabs.length / 2);
  const leftTabs  = allTabs.slice(0, half);
  const rightTabs = allTabs.slice(half);

  const openTab = (tab: NavTab) => {
    if (tab.onClick) { tab.onClick(); return; }
    if (!tab.href || pathname === tab.href) return;
    emitNavStart();
    navigate(tab.href);
  };

  // Route-aware create button — null means hidden (nothing to create on this page)
  const fab = useMemo<{ label: string; action: () => void } | null>(() => {
    switch (pathname) {
      case "/projects":         return { label: "New Project",   action: () => navigate("/projects/new") };
      case "/campaigns":        return { label: "New Campaign",  action: () => navigate("/campaigns/new") };
      case "/site-maintenance": return { label: "Register Site", action: () => navigate("/site-maintenance/new") };
      case "/setting-config/user-management":
        return { label: "New User",    action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_USER_EVENT)) };
      case "/setting-config/role-management":
        return { label: "New Role",    action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_ROLE_EVENT)) };
      case "/setting-config/module-management":
        return { label: "New Module",  action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_MODULE_EVENT)) };
      case "/setting-config/api-key-management":
        return { label: "New API Key", action: () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_APIKEY_EVENT)) };
      default:                  return null;
    }
  }, [pathname, navigate]);

  return (
    <>
      {/* ── Spacer so content is never hidden behind the bar ──────────── */}
      {/* handled by paddingBottom in DashboardLayout */}

      {/* ── Floating island bar ──────────────────────────────────────────── */}
      <nav
        aria-label="Main"
        className="mobile-bottom-bar"
        style={{
          position:     "fixed",
          left:         `calc(${ISLAND_GAP}px + env(safe-area-inset-left, 0px))`,
          right:        `calc(${ISLAND_GAP}px + env(safe-area-inset-right, 0px))`,
          bottom:       `max(${ISLAND_GAP}px, env(safe-area-inset-bottom, 0px))`,
          zIndex:       700,
          height:       62,
          display:      "flex",
          alignItems:   "stretch",
          borderRadius: 24,
          background:   "var(--bottom-bar-bg)",
          border:       "1px solid var(--glass-border, var(--sc-border))",
          boxShadow:    "0 10px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
          WebkitTapHighlightColor: "transparent",
          // Hide while scrolling down — far enough that the raised + goes too
          transform:    barHidden ? `translateY(calc(100% + ${ISLAND_GAP + FAB_SIZE}px))` : "translateY(0)",
          transition:   "transform 320ms cubic-bezier(0.4,0,0.2,1)",
          willChange:   "transform",
        }}
      >
        <TabStrip tabs={leftTabs}  activeKey={activeKey} tabRefs={tabRefs} onOpen={openTab} />

        {/* Centre slot — raised + sits in a "notch" (ring in the page colour) */}
        <div style={{ flex: `0 0 ${FAB_SLOT}px`, position: "relative" }}>
          {fab && (
            <button
              onClick={fab.action}
              aria-label={fab.label}
              title={fab.label}
              style={{
                position:       "absolute",
                left:           "50%",
                top:            -(FAB_SIZE / 2) + 4,
                width:          FAB_SIZE,
                height:         FAB_SIZE,
                marginLeft:     -FAB_SIZE / 2,
                borderRadius:   "50%",
                border:         "none",
                cursor:         "pointer",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                background:     "linear-gradient(145deg, #8b6dff 0%, var(--primary) 55%, #5634e0 100%)",
                boxShadow:      "0 0 0 5px var(--sc-shell), 0 8px 22px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.25)",
                WebkitTapHighlightColor: "transparent",
                transition:     "transform 160ms cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.9)"; }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              <Plus style={{ width: 26, height: 26, color: "#ffffff", strokeWidth: 2.4 }} />
            </button>
          )}
        </div>

        <TabStrip tabs={rightTabs} activeKey={activeKey} tabRefs={tabRefs} onOpen={openTab} />
      </nav>

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
