import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import { NavItemProps } from "../../types";
import { emitNavStart } from "../../../../atoms/NavigationProgress";

const NavIcon: React.FC<{ Icon: React.ComponentType<{ className?: string }>; isActive: boolean }> = ({ Icon, isActive }) => (
  <span
    style={{
      width: 20,
      height: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      color: isActive ? "var(--sb-text-active)" : "var(--sb-text)",
      transition: "color 140ms ease",
    }}
  >
    <Icon className="w-[15px] h-[15px]" />
  </span>
);

const itemStyle = (isActive: boolean, level: number): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: level > 0 ? "5px 8px 5px 6px" : "6px 10px",
  gap: 8,
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease",
  background: isActive ? "var(--sb-active)" : "transparent",
  color: isActive ? "var(--sb-text-active)" : "var(--sb-text)",
  border: "none",
  textDecoration: "none",
  boxSizing: "border-box",
  lineHeight: 1.4,
});

// ── NavLinkItem ────────────────────────────────────────────────────────────
const NavLinkItem: React.FC<NavItemProps> = ({ item, isCollapsed, isActive, level = 0, onClick }) => (
  <Link
    to={item.href!}
    onClick={() => { if (!isActive) emitNavStart(); onClick?.(); }}
    title={isCollapsed ? item.name : undefined}
    style={{
      ...itemStyle(!!isActive, level),
      justifyContent: isCollapsed ? "center" : "flex-start",
    }}
    onMouseEnter={e => {
      if (!isActive) {
        (e.currentTarget as HTMLElement).style.background = "var(--sb-hover)";
      }
    }}
    onMouseLeave={e => {
      if (!isActive) {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }
    }}
  >
    {item.icon && <NavIcon Icon={item.icon} isActive={!!isActive} />}
    {!isCollapsed && (
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </span>
    )}
  </Link>
);

// ── NavButtonItem — for items with children (accordion) ───────────────────
const NavButtonItem: React.FC<NavItemProps> = ({ item, isCollapsed, level = 0, isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    title={isCollapsed ? item.name : undefined}
    style={{
      ...itemStyle(false, level),
      justifyContent: isCollapsed ? "center" : "flex-start",
    }}
    aria-expanded={isOpen}
    onMouseEnter={e => {
      e.currentTarget.style.background = "var(--sb-hover)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "transparent";
    }}
  >
    {item.icon && <NavIcon Icon={item.icon} isActive={false} />}
    {!isCollapsed && (
      <>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
          {item.name}
        </span>
        {!!item.children?.length && (
          isOpen
            ? <ChevronDown className="w-[13px] h-[13px] flex-shrink-0" style={{ color: "var(--sb-text)" }} />
            : <ChevronRight className="w-[13px] h-[13px] flex-shrink-0" style={{ color: "var(--sb-text)" }} />
        )}
      </>
    )}
  </button>
);

// ── NavItem ────────────────────────────────────────────────────────────────
const NavItem: React.FC<NavItemProps> = (props) => {
  if (props.item.href) return <NavLinkItem {...props} />;
  return <NavButtonItem {...props} />;
};

export default NavItem;
