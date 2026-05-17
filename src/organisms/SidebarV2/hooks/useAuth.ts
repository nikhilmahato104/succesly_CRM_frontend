import { useState, useCallback } from "react";
import { useAuthContext } from "../../../context/AuthContext";
import { STORAGE_KEYS } from "../constants";

interface UseAuthReturn {
  showLogoutModal:    boolean;
  handleLogoutClick:  () => void;
  handleCancelLogout: () => void;
  handleLogout:       () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const { logout } = useAuthContext();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick  = useCallback(() => setShowLogoutModal(true),  []);
  const handleCancelLogout = useCallback(() => setShowLogoutModal(false), []);

  const handleLogout = useCallback(async () => {
    // Clean up any sidebar-local storage keys before delegating to AuthContext.logout.
    // AuthContext.logout calls POST /auth/logout (invalidates session + clears rt cookie)
    // and then clears all Redux auth state.
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setShowLogoutModal(false);
    await logout();
  }, [logout]);

  return { showLogoutModal, handleLogoutClick, handleCancelLogout, handleLogout };
};
