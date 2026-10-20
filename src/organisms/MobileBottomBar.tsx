import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  LayoutDashboard, Smartphone, Link2, Menu, PlusSquare,
  FolderKanban, Construction, ChevronRight, type LucideIcon,
} from "lucide-react";
import { selectAccessData } from "../store/slices/accessSlice";
import { useBottomBarRoutes } from "../hooks/useSwipeNavigation";
import { CleanModal } from "../atoms/my_clean_code_atoms";
import { emitNavStartIfNeeded } from "../routes/KeepAliveOutlet";

interface Props {
  onMenuOpen: () => void;
}

// Custom events — each page listens for its own event to open the create modal
export const OPEN_CREATE_USER_EVENT     = "uttm-open-create-user";
export const OPEN_CREATE_ROLE_EVENT     = "uttm-open-create-role";
export const OPEN_CREATE_APIKEY_EVENT   = "uttm-open-create-api-key";
export const OPEN_CREATE_MODULE_EVENT   = "uttm-open-create-module";

// ── Instagram-style bar: 2 tabs · + · 2 tabs ────────────────────────────────
// Only the most-used pages live here; everything else is one tap away in Menu.

type Tab = { key: string; icon: LucideIcon; label: string; href?: string; onClick?: () => void };

const ICON_SIZE = 26;
const BAR_H     = 50;

// ── Create sheet (opened by + where the page has no create action of its own) ──

type CreateItem = { moduleId: string; label: string; description: string; href: string; icon: LucideIcon };

const CREATE_ITEMS: CreateItem[] = [
  { moduleId: "project_management",                label: "New Project",   description: "Client, billing and deployment details", href: "/projects/new",         icon: FolderKanban },
  { moduleId: "campaign_and_short_url_management", label: "New Campaign",  description: "UTM link with a short url",              href: "/campaigns/new",        icon: Link2 },
  { moduleId: "site_maintenance",                  label: "Register Site", description: "Put a site under maintenance control",    href: "/site-maintenance/new", icon: Construction },
];

const CreateSheet: React.FC<{
  isOpen:   boolean;
  onClose:  () => void;
  items:    CreateItem[];
  onSelect: (href: string) => void;
}> = ({ isOpen, onClose, items, onSelect }) => (
  <CleanModal mode="sheet" isOpen={isOpen} onClose={onClose} title="Create" expandable={false} closeOnBackdrop>
    <ul style={{ listStyle: "none", margin: 0, padding: "0 0 env(safe-area-inset-bottom)", display: "flex", flexDirection: "column", gap: 2 }}>
      {items.length === 0 && (
        <li style={{ padding: "16px 4px", fontSize: 13, color: "var(--fi-muted)" }}>Nothing to create with your access.</li>
      )}
      {items.map(({ href, label, description, icon: Icon }) => (
        <li key={href}>
          <button
            type="button"
            onClick={() => onSelect(href)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 8px", borderRadius: "var(--radius)", border: "none",
              background: "transparent", cursor: "pointer", textAlign: "left",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{
              width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--sb-active)", color: "var(--fi-text)",
            }}>
              <Icon style={{ width: 20, height: 20 }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--fi-text)" }}>{label}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--fi-muted)", marginTop: 2 }}>{description}</span>
            </span>
            <ChevronRight style={{ width: 16, height: 16, color: "var(--fi-muted)", flexShrink: 0 }} />
          </button>
        </li>
      ))}
    </ul>
  </CleanModal>
);

// ── Bar ──────────────────────────────────────────────────────────────────────

const BarButton: React.FC<{ tab: Tab; active: boolean; onPress: () => void }> = ({ tab, active, onPress }) => {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      onClick={onPress}
      style={{
        flex:           1,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "transparent",
        border:         "none",
        padding:        0,
        cursor:         "pointer",
        color:          "var(--sb-text)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Active tab sits in a rounded pill — like the Instagram DM tab */}
      <span style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          56,
        height:         36,
        borderRadius:   18,
        background:     active ? "var(--sb-active)" : "transparent",
        transition:     "background 180ms ease, transform 160ms ease",
      }}>
        <Icon style={{ width: ICON_SIZE, height: ICON_SIZE, strokeWidth: active ? 2.4 : 1.7 }} />
      </span>
    </button>
  );
};

const MobileBottomBar: React.FC<Props> = ({ onMenuOpen }) => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const access       = useSelector((s: any) => selectAccessData(s));
  const [createOpen, setCreateOpen] = useState(false);

  // Same list the swipe pager cycles through — only pages this role can open
  const { dashboard, devices, campaigns } = useBottomBarRoutes();

  const leftTabs = useMemo<Tab[]>(() => [
    ...(dashboard ? [{ key: "dashboard", icon: LayoutDashboard, label: "Dashboard",   href: dashboard }] : []),
    ...(devices   ? [{ key: "devices",   icon: Smartphone,      label: "Device Info", href: devices }]   : []),
  ], [dashboard, devices]);

  const rightTabs = useMemo<Tab[]>(() => [
    ...(campaigns ? [{ key: "campaigns", icon: Link2, label: "Campaigns", href: campaigns }] : []),
    { key: "menu", icon: Menu, label: "Menu", onClick: onMenuOpen },
  ], [campaigns, onMenuOpen]);

  const createItems = useMemo(
    () => CREATE_ITEMS.filter(item => access?.[item.moduleId]?.view && access?.[item.moduleId]?.create !== false),
    [access],
  );

  const isActive = (tab: Tab) => !!tab.href && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));

  const press = (tab: Tab) => {
    if (tab.onClick) { tab.onClick(); return; }
    if (!tab.href || pathname === tab.href) return;
    emitNavStartIfNeeded(tab.href);
    navigate(tab.href);
  };

  // The + runs the page's own create action; elsewhere it opens the Create sheet
  const routeCreate = useMemo<(() => void) | null>(() => {
    switch (pathname) {
      case "/projects":         return () => navigate("/projects/new");
      case "/campaigns":        return () => navigate("/campaigns/new");
      case "/site-maintenance": return () => navigate("/site-maintenance/new");
      case "/setting-config/user-management":     return () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_USER_EVENT));
      case "/setting-config/role-management":     return () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_ROLE_EVENT));
      case "/setting-config/module-management":   return () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_MODULE_EVENT));
      case "/setting-config/api-key-management":  return () => window.dispatchEvent(new CustomEvent(OPEN_CREATE_APIKEY_EVENT));
      default:                  return null;
    }
  }, [pathname, navigate]);

  const pickCreate = (href: string) => {
    setCreateOpen(false);
    emitNavStartIfNeeded(href);
    navigate(href);
  };

  // ── Scroll-aware hide/show (Instagram style) ──────────────────────────────
  const [barHidden, setBarHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef         = useRef(0);

  useEffect(() => {
    const THRESHOLD = 6;
    const handler = (e: Event) => {
      const scrollY = (e.target as HTMLElement).scrollTop ?? 0;
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

  return (
    <>
      <nav
        aria-label="Main"
        className="mobile-bottom-bar"
        style={{
          position:      "fixed",
          left:          0,
          right:         0,
          bottom:        0,
          zIndex:        700,
          display:       "flex",
          alignItems:    "stretch",
          height:        `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft:   "env(safe-area-inset-left, 0px)",
          paddingRight:  "env(safe-area-inset-right, 0px)",
          boxSizing:     "border-box",
          background:    "var(--bottom-bar-bg)",
          borderTop:     "1px solid var(--sb-border)",
          WebkitTapHighlightColor: "transparent",
          transform:     barHidden ? "translateY(100%)" : "translateY(0)",
          transition:    "transform 300ms cubic-bezier(0.4,0,0.2,1)",
          willChange:    "transform",
        }}
      >
        {leftTabs.map(tab => <BarButton key={tab.key} tab={tab} active={isActive(tab)} onPress={() => press(tab)} />)}

        {/* Centre + — same outline style as Instagram's "new post" */}
        <BarButton
          tab={{ key: "create", icon: PlusSquare, label: "Create" }}
          active={createOpen}
          onPress={() => (routeCreate ? routeCreate() : setCreateOpen(true))}
        />

        {rightTabs.map(tab => <BarButton key={tab.key} tab={tab} active={isActive(tab)} onPress={() => press(tab)} />)}
      </nav>

      <CreateSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        items={createItems}
        onSelect={pickCreate}
      />
    </>
  );
};

export default MobileBottomBar;
