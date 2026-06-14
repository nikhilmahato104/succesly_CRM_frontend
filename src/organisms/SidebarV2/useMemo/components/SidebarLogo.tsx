import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface SidebarLogoProps {
  isCollapsed: boolean;
  isHovered?: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

const logoBox: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sb-text-active)",
  color: "var(--sb-bg)",
  fontWeight: 800,
  fontSize: 15,
  userSelect: "none",
  flexShrink: 0,
  letterSpacing: "-0.02em",
};

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
      <div style={{ padding: "12px 0 10px", display: "flex", justifyContent: "center", borderBottom: "1px solid var(--sb-border)" }}>
        <button
          onClick={onExpand}
          aria-label="Expand sidebar"
          style={{ ...collapseBtn, width: 34, height: 34, borderRadius: 9 }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; e.currentTarget.style.color = "var(--sb-text-active)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sb-text-dim)"; }}
        >
          {isHovered
            ? <PanelLeftOpen style={{ width: 17, height: 17 }} />
            : <span style={logoBox}>N</span>
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
      {/* Logo mark + brand name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", minWidth: 0 }}>
        <span style={logoBox}>N</span>
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
