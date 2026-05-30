import React from "react";
import { ChevronDown, User, LogOut } from "lucide-react";
import { UserProfileProps } from "../../types";

const getInitials = (name: string): string =>
  name.split(" ").map((w) => w.charAt(0)).join("").toUpperCase().slice(0, 2);

// ── Avatar ─────────────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; url?: string | null }> = ({ name, url }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImg = !!url && !imgFailed;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: showImg ? "transparent" : "var(--sb-text-active)",
          color: "var(--sb-bg)", fontSize: 12, fontWeight: 700,
          userSelect: "none", letterSpacing: "0.02em", overflow: "hidden",
        }}
      >
        {showImg
          ? <img src={url!} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
          : getInitials(name)
        }
      </div>
      <div
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 9, height: 9, borderRadius: "50%",
          background: "#22c55e", border: "2px solid var(--sb-bg)",
        }}
      />
    </div>
  );
};

// ── Telegram-style Sun/Moon pill toggle ────────────────────────────────────
const ThemeToggle: React.FC<{ isDarkMode: boolean; onToggle: (x: number, y: number) => void }> = ({ isDarkMode, onToggle }) => {
  const PILL_W  = 76;
  const PILL_H  = 36;
  const KNOB    = 30;
  const PAD     = 3;

  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--sb-border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sb-text-active)", margin: "0 0 1px" }}>Theme</p>
          <p style={{ fontSize: 11, color: "var(--sb-text-dim)", margin: 0 }}>
            {isDarkMode ? "Dark mode" : "Light mode"}
          </p>
        </div>

        {/* Pill toggle */}
        <button
          onClick={(e) => onToggle(e.clientX, e.clientY)}
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            position:    "relative",
            width:       PILL_W,
            height:      PILL_H,
            borderRadius: PILL_H / 2,
            border:      "none",
            cursor:      "pointer",
            padding:     0,
            flexShrink:  0,
            background:  isDarkMode ? "#1a1a2e" : "#e8e8f0",
            boxShadow:   isDarkMode
              ? "inset 0 1px 4px rgba(0,0,0,0.5)"
              : "inset 0 1px 4px rgba(0,0,0,0.12)",
            transition:  "background 300ms ease",
          }}
        >
          {/* Sliding knob */}
          <div
            style={{
              position:    "absolute",
              top:         PAD,
              left:        isDarkMode ? PILL_W - KNOB - PAD : PAD,
              width:       KNOB,
              height:      KNOB,
              borderRadius: "50%",
              background:  "#ffffff",
              boxShadow:   "0 2px 8px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)",
              transition:  "left 280ms cubic-bezier(0.4,0,0.2,1)",
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              zIndex:      2,
            }}
          >
            {isDarkMode
              ? (
                /* Moon icon on knob */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    fill="#4f46e5" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
              : (
                /* Sun icon on knob */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="5" fill="#f59e0b" />
                  <line x1="12" y1="1"  x2="12" y2="3"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="21" x2="12" y2="23" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="1"  y1="12" x2="3"  y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="21" y1="12" x2="23" y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )
            }
          </div>

          {/* Background icons (always visible, opposite side) */}
          {/* Sun on left when dark, Moon on right when light */}
          <div
            style={{
              position:    "absolute",
              top:         "50%",
              transform:   "translateY(-50%)",
              left:        isDarkMode ? PAD + 5 : PILL_W - KNOB - PAD + 8,
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              width:       20,
              height:      20,
              opacity:     0.45,
              transition:  "left 280ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease",
              zIndex:      1,
              pointerEvents: "none",
            }}
          >
            {isDarkMode
              ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="5" fill="#f59e0b" />
                  <line x1="12" y1="1"  x2="12" y2="3"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="21" x2="12" y2="23" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="1"  y1="12" x2="3"  y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="21" y1="12" x2="23" y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )
              : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    fill="#6366f1" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            }
          </div>
        </button>
      </div>
    </div>
  );
};

// ── ProfileDropdown ────────────────────────────────────────────────────────
const ProfileDropdown: React.FC<{
  userName: string;
  userEmail: string;
  isDarkMode: boolean;
  onToggleDarkMode: (x: number, y: number) => void;
  onProfileClick: () => void;
  onLogoutClick: () => void;
}> = ({ userName, userEmail, isDarkMode, onToggleDarkMode, onProfileClick, onLogoutClick }) => (
  <div
    style={{
      position: "absolute",
      bottom: "calc(100% + 6px)",
      left: 8,
      right: 8,
      background: "var(--sb-elevated)",
      borderRadius: 10,
      boxShadow: "0 8px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
      border: "1px solid var(--sb-border)",
      overflow: "hidden",
      zIndex: 50,
    }}
  >
    {/* User info */}
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--sb-border)" }}>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--sb-text-active)", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</p>
      <p style={{ fontSize: 11.5, color: "var(--sb-text-dim)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</p>
    </div>

    <ThemeToggle isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />

    {/* Profile */}
    <button
      onClick={onProfileClick}
      style={{ display: "flex", alignItems: "center", width: "100%", padding: "10px 14px", fontSize: 13, color: "var(--sb-text)", background: "transparent", border: "none", cursor: "pointer", transition: "background 150ms ease", boxSizing: "border-box", gap: 10 }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <User style={{ width: 15, height: 15, flexShrink: 0, color: "var(--sb-text-dim)" }} />
      My Profile
    </button>

    {/* Logout */}
    <div style={{ borderTop: "1px solid var(--sb-border)" }}>
      <button
        onClick={onLogoutClick}
        style={{ display: "flex", alignItems: "center", width: "100%", padding: "10px 14px", fontSize: 13, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer", transition: "background 150ms ease", boxSizing: "border-box", gap: 10 }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
        Sign out
      </button>
    </div>
  </div>
);

// ── UserProfile ────────────────────────────────────────────────────────────
const UserProfile: React.FC<UserProfileProps> = ({
  isCollapsed = false,
  userName,
  userEmail,
  profileImageUrl,
  isDarkMode,
  profileDropdownOpen,
  onToggleDropdown,
  onToggleDarkMode,
  onProfileClick,
  onLogoutClick,
}) => (
  <div style={{ position: "relative", borderTop: "1px solid var(--sb-border)", padding: "6px 8px" }}>
    <button
      onClick={onToggleDropdown}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        width: "100%",
        minHeight: 40,
        padding: isCollapsed ? "4px 0" : "5px 8px",
        gap: 10,
        borderRadius: 9,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        transition: "background 140ms ease",
        boxSizing: "border-box",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <Avatar name={userName} url={profileImageUrl} />
      {!isCollapsed && (
        <>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--sb-text-active)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
              {userName}
            </p>
          </div>
          <ChevronDown
            style={{
              width: 14,
              height: 14,
              color: "var(--sb-text-dim)",
              flexShrink: 0,
              transition: "transform 200ms ease",
              transform: profileDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </>
      )}
    </button>

    {profileDropdownOpen && !isCollapsed && (
      <ProfileDropdown
        userName={userName}
        userEmail={userEmail}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onProfileClick={onProfileClick}
        onLogoutClick={onLogoutClick}
      />
    )}
  </div>
);

export default UserProfile;
