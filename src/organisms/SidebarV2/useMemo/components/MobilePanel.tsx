import React from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import logoImg from "../../../../assets/images/logo.png";
import { Z_INDEX } from "../../constants";
import { UserProfileProps } from "../../types";
import UserProfile from "./UserProfile";
import { ShinyText } from "../../../../atoms/reactbits";

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
      <Drawer.Title style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
        <ShinyText text="My Learning" speed={3.5} />
      </Drawer.Title>
    </div>
    <button
      onClick={onClose}
      aria-label="Close menu"
      style={{ padding: 6, borderRadius: "var(--radius)", border: "none", background: "transparent", cursor: "pointer", color: "var(--sb-text-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; e.currentTarget.style.color = "var(--sb-text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sb-text-dim)"; }}
    >
      <X style={{ width: 17, height: 17 }} />
    </button>
  </div>
);

// ── MobilePanel ────────────────────────────────────────────────────────────
// vaul left drawer: swipe left (or tap the backdrop) to close, with
// velocity-aware release like native app drawers.
const MobilePanel: React.FC<MobilePanelProps> = ({
  expanded,
  onClose,
  children,
  ...profileProps
}) => (
  <Drawer.Root
    open={expanded}
    onOpenChange={(o) => { if (!o) onClose(); }}
    direction="left"
  >
    <Drawer.Portal>
      <Drawer.Overlay
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: Z_INDEX.BACKDROP,
        }}
      />
      <Drawer.Content
        aria-describedby={undefined}
        // Logout confirm / profile card are portaled outside the drawer
        onInteractOutside={e => {
          if (e.target instanceof Element && e.target.closest("[data-portal-popup]")) e.preventDefault();
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: "85vw",
          background: "var(--sb-drawer-bg, var(--sb-bg))",
          borderRight: "1px solid var(--sb-border)",
          zIndex: Z_INDEX.SIDEBAR,
          display: "flex",
          flexDirection: "column",
          outline: "none",
        }}
      >
        <MobilePanelHeader onClose={onClose} />

        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 8px 16px" }} className="sc-scrollbar">
          <ul className="rb-stagger-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {children}
          </ul>
        </nav>

        <UserProfile isCollapsed={false} {...profileProps} />
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
);

export default MobilePanel;
