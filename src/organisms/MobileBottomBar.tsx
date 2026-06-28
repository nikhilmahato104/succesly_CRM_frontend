import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Plus, FolderKanban, Menu } from "lucide-react";

interface Props {
  onMenuOpen: () => void;
}

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",  href: "/" },
  { icon: BookOpen,        label: "Bookings",   href: "/booking-management" },
  null, // FAB slot
  { icon: FolderKanban,   label: "Projects",   href: "/projects" },
  { icon: Menu,           label: "Menu",       href: null },
] as const;

const MobileBottomBar: React.FC<Props> = ({ onMenuOpen }) => {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  const isActive = (href: string | null) =>
    href ? (href === "/" ? pathname === "/" : pathname.startsWith(href)) : false;

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
          zIndex:          300,
          background:      "var(--bottom-bar-bg)",
          backdropFilter:  "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          display:         "flex",
          alignItems:      "stretch",
          paddingBottom:   "env(safe-area-inset-bottom, 0px)",
          paddingLeft:     "env(safe-area-inset-left, 0px)",
          paddingRight:    "env(safe-area-inset-right, 0px)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {NAV.map((item, i) => {
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
                <button
                  onClick={() => navigate("/projects/new")}
                  aria-label="New Project"
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
                    boxShadow:       "0 4px 16px rgba(124,58,237,0.45)",
                    transform:       "translateY(-10px)",
                    /* touch feedback */
                    WebkitTapHighlightColor: "transparent",
                    transition:      "transform 120ms ease, box-shadow 120ms ease",
                    flexShrink:      0,
                  }}
                  onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-8px) scale(0.93)"; }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-10px) scale(1)"; }}
                >
                  <Plus style={{ width: 24, height: 24, color: "#ffffff" }} />
                </button>
              </div>
            );
          }

          /* ── Regular tab ────────────────────────────────────────────── */
          const active = isActive(item.href);
          const Icon   = item.icon;

          return (
            <button
              key={i}
              aria-label={item.label}
              onClick={() => item.href ? navigate(item.href) : onMenuOpen()}
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
    </>
  );
};

export default MobileBottomBar;
