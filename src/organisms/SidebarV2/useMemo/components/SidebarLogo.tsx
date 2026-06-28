import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import logoImg from "../../../../assets/images/logo.png";

interface SidebarLogoProps {
  isCollapsed: boolean;
  isHovered?: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

const collapseBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 7,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#ffffff",
  transition: "background 140ms ease",
  flexShrink: 0,
};

const SidebarLogo: React.FC<SidebarLogoProps> = ({ isCollapsed, isHovered, onCollapse, onExpand }) => {
  if (isCollapsed) {
    return (
      <div style={{ height: 42, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--sb-border)", boxSizing: "border-box", flexShrink: 0 }}>
        <button
          onClick={onExpand}
          aria-label="Expand sidebar"
          style={{ ...collapseBtn, width: 34, height: 34, borderRadius: 9 }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; e.currentTarget.style.color = "var(--sb-text-active)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sb-text-dim)"; }}
        >
          {isHovered
            ? <PanelLeftOpen style={{ width: 17, height: 17 }} />
            : <img src={logoImg} alt="logo" style={{ width: 26, height: 26, objectFit: "contain" }} />
          }
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 42,
        padding: "0 12px",
        borderBottom: "1px solid var(--sb-border)",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {/* Logo + brand name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", minWidth: 0 }}>
        <img src={logoImg} alt="logo" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--sb-text-active)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "-0.02em",
          }}
        >
          My Learning
        </span>
      </div>

      {/* Collapse button */}
      <button
        onClick={onCollapse}
        aria-label="Collapse sidebar"
        style={collapseBtn}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <PanelLeftClose style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
};

export default SidebarLogo;
