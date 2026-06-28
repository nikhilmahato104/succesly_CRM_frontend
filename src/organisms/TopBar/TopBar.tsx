import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Settings, ChevronDown, Sun, Moon, User, LogOut, ArrowLeft, LayoutDashboard, Maximize2 } from "lucide-react";
import { selectUserData } from "../../store/slices/userSlice";
import { selectPageTitle } from "../../store/slices/pageTitleSlice";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useLayoutMode, type LayoutMode } from "../../hooks/useLayoutMode";
import { useAuth } from "../SidebarV2/hooks/useAuth";
import WarningModal from "../../atoms/WarningModal";
import logoImg from "../../assets/images/logo.png";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const getInitials = (name: string): string =>
  name.split(" ").map((w) => w.charAt(0)).join("").toUpperCase().slice(0, 2);

// ── Avatar ────────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string; url?: string | null; size?: number }> = ({ name, url, size = 30 }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImg = !!url && !imgFailed;
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   "50%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     showImg ? "transparent" : "var(--sb-text-active)",
        color:          "var(--sb-bg)",
        fontSize:       size * 0.38,
        fontWeight:     600,
        userSelect:     "none",
        flexShrink:     0,
        letterSpacing:  "0.01em",
        overflow:       "hidden",
      }}
    >
      {showImg
        ? <img src={url!} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
        : getInitials(name)
      }
    </div>
  );
};

// ── Icon button ───────────────────────────────────────────────────────────────

const IconBtn: React.FC<{
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}> = ({ children, title, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      width:          30,
      height:         30,
      borderRadius:   6,
      border:         "none",
      background:     "transparent",
      cursor:         "pointer",
      color:          "var(--sb-text-dim)",
      transition:     "background 140ms ease, color 140ms ease",
      flexShrink:     0,
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = "var(--sb-hover)";
      (e.currentTarget as HTMLButtonElement).style.color = "var(--sb-text-active)";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      (e.currentTarget as HTMLButtonElement).style.color = "var(--sb-text-dim)";
    }}
  >
    {children}
  </button>
);

// ── Profile dropdown ──────────────────────────────────────────────────────────

const ProfileDropdown: React.FC<{
  userName: string;
  userEmail: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onProfile: () => void;
  onLogout: () => void;
}> = ({ userName, userEmail, isDarkMode, onToggleDarkMode, onProfile, onLogout }) => (
  <div
    style={{
      position:   "absolute",
      top:        "calc(100% + 6px)",
      right:      0,
      minWidth:   210,
      background: "var(--sb-elevated)",
      border:     "1px solid var(--sb-border)",
      borderRadius: 8,
      boxShadow:  "0 4px 20px rgba(0,0,0,0.15)",
      overflow:   "hidden",
      zIndex:     200,
    }}
  >
    {/* User info */}
    <div style={{ padding: "10px 13px", borderBottom: "1px solid var(--sb-border)" }}>
      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 500, color: "var(--sb-text-active)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {userName}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "var(--sb-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {userEmail}
      </p>
    </div>

    {/* Theme toggle */}
    <button
      onClick={onToggleDarkMode}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 13px", fontSize: 13, color: "var(--sb-text)", background: "transparent", border: "none", cursor: "pointer", boxSizing: "border-box" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isDarkMode
          ? <Moon style={{ width: 13, height: 13, color: "#a5b4fc", flexShrink: 0 }} />
          : <Sun  style={{ width: 13, height: 13, color: "#ca8a04", flexShrink: 0 }} />
        }
        {isDarkMode ? "Dark mode" : "Light mode"}
      </span>
      {/* Clean pill — no track icons */}
      <div style={{ position: "relative", width: 36, height: 20, borderRadius: 10, background: isDarkMode ? "#4b5563" : "#d1d5db", transition: "background 200ms ease", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: isDarkMode ? 17 : 2, width: 16, height: 16, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.30)", transition: "left 200ms ease" }} />
      </div>
    </button>

    {/* Profile */}
    <button
      onClick={onProfile}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 13px", fontSize: 13, color: "var(--sb-text)", background: "transparent", border: "none", cursor: "pointer", boxSizing: "border-box" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <User style={{ width: 13, height: 13 }} />
      My Profile
    </button>

    <div style={{ borderTop: "1px solid var(--sb-border)" }}>
      <button
        onClick={onLogout}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 13px", fontSize: 13, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer", boxSizing: "border-box" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <LogOut style={{ width: 13, height: 13 }} />
        Sign out
      </button>
    </div>
  </div>
);

// ── Layout picker ─────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    mode:        "comfortable",
    label:       "Comfortable",
    description: "Gaps and rounded panels",
    icon: (
      <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
        <rect x="1" y="1" width="10" height="24" rx="2" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1" />
        <rect x="14" y="1" width="23" height="24" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
        <rect x="14" y="1" width="23" height="6" rx="2" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    mode:        "compact",
    label:       "Full Screen",
    description: "Flush edge to edge",
    icon: (
      <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
        <rect x="0" y="0" width="11" height="26" fill="currentColor" opacity="0.25" />
        <rect x="11" y="0" width="27" height="26" fill="currentColor" opacity="0.15" />
        <rect x="11" y="0" width="27" height="7" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
];

const LayoutPicker: React.FC<{ mode: LayoutMode; onSelect: (m: LayoutMode) => void }> = ({ mode, onSelect }) => (
  <div
    style={{
      position:     "absolute",
      top:          "calc(100% + 6px)",
      right:        0,
      background:   "var(--sb-elevated)",
      border:       "1px solid var(--sb-border)",
      borderRadius: 10,
      boxShadow:    "0 4px 20px rgba(0,0,0,0.18)",
      padding:      "10px",
      zIndex:       200,
      display:      "flex",
      gap:          8,
      minWidth:     200,
    }}
  >
    {LAYOUT_OPTIONS.map((opt) => {
      const active = mode === opt.mode;
      return (
        <button
          key={opt.mode}
          type="button"
          onClick={() => onSelect(opt.mode)}
          style={{
            flex:         1,
            display:      "flex",
            flexDirection:"column",
            alignItems:   "center",
            gap:          6,
            padding:      "10px 8px 8px",
            borderRadius: 8,
            border:       active ? "1.5px solid var(--sb-text-active)" : "1.5px solid var(--sb-border)",
            background:   active ? "rgba(255,255,255,0.06)" : "transparent",
            cursor:       "pointer",
            color:        active ? "var(--sb-text-active)" : "var(--sb-text-dim)",
            transition:   "border-color 140ms, background 140ms",
          }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sb-hover)"; }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >
          {opt.icon}
          <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{opt.label}</span>
          <span style={{ fontSize: 10, opacity: 0.6, whiteSpace: "nowrap" }}>{opt.description}</span>
        </button>
      );
    })}
  </div>
);

// ── TopBar ────────────────────────────────────────────────────────────────────

export const TopBar: React.FC = () => {
  const navigate    = useNavigate();
  const userData    = useSelector(selectUserData);
  const pageTitle   = useSelector(selectPageTitle);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [layoutMode, setLayoutMode] = useLayoutMode();
  const { showLogoutModal, handleLogoutClick, handleCancelLogout, handleLogout } = useAuth();
  const [profileOpen, setProfileOpen]     = useState(false);
  const [layoutOpen,  setLayoutOpen]      = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const layoutRef  = useRef<HTMLDivElement>(null);
  const isMobile   = useIsMobile();

  const userName        = userData?.user_name        || "User";
  const userEmail       = userData?.user_email       || "";
  const profileImageUrl = userData?.profile_image_url ?? null;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (layoutRef.current  && !layoutRef.current.contains(e.target as Node))  setLayoutOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchClick = () => {
    // Keyboard shortcut hint — future: open command palette
    // For now just focus a possible search input or no-op
  };

  return (
    <>
      <WarningModal
        isActive={showLogoutModal}
        title="Confirm Logout"
        description="Are you sure you want to logout from your account?"
        onClose={handleCancelLogout}
        onProceed={handleLogout}
      />

    <div
      style={{
        flexShrink:      0,
        display:         "flex",
        alignItems:      "center",
        height:          42,
        padding:         "0 12px",
        borderBottom:    "1px solid var(--sb-border)",
        backgroundColor: "var(--sb-bg)",
        gap:             10,
        boxSizing:       "border-box",
      }}
    >
      {/* ── Left: workspace brand OR page title ───────────────────────────── */}
      {pageTitle.title ? (
        /* Page-title mode: ← Title */
        <button
          type="button"
          onClick={() => pageTitle.backPath && navigate(pageTitle.backPath)}
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        7,
            flexShrink: 0,
            background: "none",
            border:     "none",
            cursor:     "pointer",
            padding:    "4px 6px",
            borderRadius: 6,
            color:      "var(--sb-text-active)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sb-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <ArrowLeft style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
            {pageTitle.title}
          </span>
        </button>
      ) : (
        /* Brand mode: logo + My Learning */
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <img src={logoImg} alt="logo" style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sb-text-active)", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
            My Learning
          </span>
          {!isMobile && <ChevronDown style={{ width: 13, height: 13, color: "var(--sb-text-dim)" }} />}
        </div>
      )}

      {/* ── Separator — desktop only ───────────────────────────────────────── */}
      {!isMobile && <div style={{ width: 1, height: 18, background: "var(--sc-border)", flexShrink: 0 }} />}

      {/* ── Center: global search — desktop only ──────────────────────────── */}
      {!isMobile && <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Global search"
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            7,
            height:         "var(--btn-h-sm)",
            padding:        "0 10px",
            width:          "min(340px, 100%)",
            background:     "var(--sc-surface)",
            border:         "1px solid var(--sc-border)",
            borderRadius:   "var(--fi-radius)",
            cursor:         "pointer",
            transition:     "border-color 140ms ease, box-shadow 140ms ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--sb-border)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow   = "none";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--sc-border)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow   = "none";
          }}
        >
          <Search style={{ width: 12, height: 12, color: "var(--sb-text-dim)", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: "var(--sb-text-dim)", textAlign: "left", userSelect: "none" }}>
            Search…
          </span>
          <kbd
            style={{
              display:        "inline-flex",
              alignItems:     "center",
              gap:            2,
              padding:        "1px 5px",
              borderRadius:   4,
              border:         "1px solid var(--sc-border)",
              background:     "var(--sc-card)",
              fontSize:       10,
              color:          "var(--sb-text-dim)",
              fontFamily:     "inherit",
              letterSpacing:  "0.02em",
              userSelect:     "none",
              flexShrink:     0,
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>}

      {/* Mobile: flex spacer pushes right icons to the end */}
      {isMobile && <div style={{ flex: 1 }} />}

      {/* ── Right: actions + profile ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>

        <IconBtn title="Notifications">
          <Bell style={{ width: 15, height: 15 }} />
        </IconBtn>

        {/* Layout picker — desktop only */}
        {!isMobile && <div style={{ position: "relative" }} ref={layoutRef}>
          <IconBtn title={`Layout: ${layoutMode}`} onClick={() => setLayoutOpen((o) => !o)}>
            {layoutMode === "compact"
              ? <Maximize2 style={{ width: 14, height: 14 }} />
              : <LayoutDashboard style={{ width: 14, height: 14 }} />
            }
          </IconBtn>
          {layoutOpen && (
            <LayoutPicker
              mode={layoutMode}
              onSelect={(m) => { setLayoutMode(m); setLayoutOpen(false); }}
            />
          )}
        </div>}

        {/* Settings — desktop only */}
        {!isMobile && (
          <IconBtn title="Settings" onClick={() => navigate("/settings")}>
            <Settings style={{ width: 15, height: 15 }} />
          </IconBtn>
        )}

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "var(--sc-border)", margin: "0 3px", flexShrink: 0 }} />

        {/* Profile trigger */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            5,
              height:         30,
              padding:        "0 5px",
              borderRadius:   7,
              border:         "none",
              background:     profileOpen ? "var(--sb-hover)" : "transparent",
              cursor:         "pointer",
              transition:     "background 140ms ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sb-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = profileOpen ? "var(--sb-hover)" : "transparent"; }}
          >
            <Avatar name={userName} url={profileImageUrl} size={26} />
            {!isMobile && (
              <ChevronDown
                style={{
                  width:     11,
                  height:    11,
                  color:     "var(--sb-text-dim)",
                  transition: "transform 200ms ease",
                  transform:  profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            )}
          </button>

          {profileOpen && (
            <ProfileDropdown
              userName={userName}
              userEmail={userEmail}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
              onProfile={() => { navigate("/profile"); setProfileOpen(false); }}
              onLogout={() => { setProfileOpen(false); handleLogoutClick(); }}
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default TopBar;
