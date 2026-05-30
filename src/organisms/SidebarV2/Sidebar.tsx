import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { selectAccessData } from "../../store/slices/accessSlice";
import { selectUserData } from "../../store/slices/userSlice";

import WarningModal from "../../atoms/WarningModal";

import { useSidebar }    from "./hooks/useSidebar";
import { useDarkMode }   from "./hooks/useDarkMode";
import { useAuth }       from "./hooks/useAuth";
import { useNavigation } from "./hooks/useNavigation";

import SidebarLogo from "./useMemo/components/SidebarLogo";
import NavList     from "./useMemo/components/NavList";
import UserProfile from "./useMemo/components/UserProfile";
import MobilePanel from "./useMemo/components/MobilePanel";
import { SidebarProps, UserProfileProps } from "./types";

export const Sidebar: React.FC<SidebarProps> = ({ collapsed: collapsedProp, onCollapsedChange }) => {
  const navigate = useNavigate();
  const accessData    = useSelector((s: any) => selectAccessData(s));
  const userDataRedux = useSelector(selectUserData);

  const userName        = userDataRedux?.user_name        || "User";
  const userEmail       = userDataRedux?.user_email       || "";
  const profileImageUrl = userDataRedux?.profile_image_url ?? null;

  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { showLogoutModal, handleLogoutClick, handleCancelLogout, handleLogout } = useAuth();
  const { collapsed, isMobile, mobileExpanded, openItems, setCollapsed, setMobileExpanded, toggleAccordion, onNavClick } =
    useSidebar({ collapsedProp, onCollapsedChange });

  const navigation = useNavigation(accessData, userDataRedux?.role_name || "");

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const handleProfileClick = useCallback(() => {
    navigate("/profile");
    setProfileDropdownOpen(false);
    onNavClick();
  }, [navigate, onNavClick]);

  const profileProps: Omit<UserProfileProps, "isCollapsed"> = {
    userName,
    userEmail,
    profileImageUrl,
    isDarkMode,
    profileDropdownOpen,
    onToggleDropdown : () => setProfileDropdownOpen((o) => !o),
    onToggleDarkMode : toggleDarkMode,
    onProfileClick   : handleProfileClick,
    onLogoutClick    : handleLogoutClick,
  };

  const navListProps = {
    items      : navigation,
    isCollapsed: collapsed,
    openItems,
    onNavClick,
    onToggle   : toggleAccordion,
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

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <aside
          style={{ height: "100%", width: "100%", background: "var(--sb-bg)", display: "flex", flexDirection: "column", fontFamily: "'Bricolage Grotesque', sans-serif" }}
          onMouseEnter={() => collapsed && setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          <SidebarLogo
            isCollapsed={collapsed}
            isHovered={sidebarHovered}
            onCollapse={() => setCollapsed(true)}
            onExpand={() => { setCollapsed(false); setSidebarHovered(false); }}
          />

          {/* Collapsed: symmetric horizontal padding so icons sit centred under logo.
              Expanded:  8px each side for label breathing room.              */}
          <nav
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 8px" }}
            className="sc-scrollbar"
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <NavList {...navListProps} />
            </ul>
          </nav>

          <UserProfile isCollapsed={collapsed} {...profileProps} />
        </aside>
      )}

      {/* ── Mobile slide panel (portal) ── */}
      {isMobile && (
        <MobilePanel
          expanded={mobileExpanded}
          onClose={() => setMobileExpanded(false)}
          {...profileProps}
        >
          <NavList {...navListProps} />
        </MobilePanel>
      )}
    </>
  );
};

export default Sidebar;
