import React from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import logoImg from "../../../../assets/images/logo.png";
import { Z_INDEX, TRANSITIONS } from "../../constants";
import { UserProfileProps } from "../../types";
import UserProfile from "./UserProfile";

interface MobilePanelProps extends Omit<UserProfileProps, "isCollapsed"> {
  expanded: boolean;
  onClose: () => void;
  children: React.ReactNode; // rendered NavList
}

// ── MobilePanelHeader ──────────────────────────────────────────────────────
const MobilePanelHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--sb-border)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={logoImg} alt="logo" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--sb-text-active)", letterSpacing: "-0.02em" }}>My Learning</span>
    </div>
    <button
      onClick={onClose}
      aria-label="Close menu"
      style={{ padding: 6, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: "var(--sb-text-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; e.currentTarget.style.color = "var(--sb-text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sb-text-dim)"; }}
    >
      <X style={{ width: 17, height: 17 }} />
    </button>
  </div>
);

// ── MobilePanel ────────────────────────────────────────────────────────────
const MobilePanel: React.FC<MobilePanelProps> = ({
  expanded,
  onClose,
  children,
  ...profileProps
}) => {
  if (typeof document === "undefined") return null;

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: Z_INDEX.BACKDROP,
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
          transition: TRANSITIONS.OPACITY,
          
        }}
      />

      {/* Slide panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100%",
          minHeight: "100dvh",
          width: 280,
          background: "var(--sb-bg)",
          borderRight: "1px solid var(--sb-border)",
          zIndex: Z_INDEX.SIDEBAR,
          transform: expanded ? "translateX(0)" : "translateX(-100%)",
          transition: TRANSITIONS.MOBILE,
          willChange: "transform",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MobilePanelHeader onClose={onClose} />

        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 8px 16px" }} className="sc-scrollbar">
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {children}
          </ul>
        </nav>

        <UserProfile isCollapsed={false} {...profileProps} />
      </div>
    </>
  );

  return ReactDOM.createPortal(panel, document.body);
};

export default MobilePanel;