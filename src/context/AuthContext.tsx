// AuthContext.tsx — Secure Auth v2.0
//
// TOKEN STRATEGY (from backend PRD):
//   accessToken  → Redux store (memory only, NOT persisted) — 15 min
//   csrfToken    → Redux store (memory only, NOT persisted) — same session as rt
//   rt cookie    → httpOnly cookie set by server — JS cannot read it — 7 days
//
// PAGE REFRESH FLOW:
//   accessToken is gone (Redux not persisted) → call POST /auth/refresh
//   Browser automatically sends the httpOnly rt cookie
//   Server returns new accessToken + csrfToken → stored in Redux
//   Then fetch /auth/profile to restore user/role data in Redux

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { postData, getData } from "../services/crmServices";
import { showToastnew } from "../services/toastifynewService/toastifynewService";
import { setUserData, clearUserData, selectUserData } from "../store/slices/userSlice";
import { setAccessData, clearAccessData } from "../store/slices/accessSlice";
import { clearApiKey } from "../store/slices/apiKeySlice";
import { setAuthTokens, clearAuthTokens, selectAccessToken } from "../store/slices/authSlice";
import { clearAllAuthState } from "../lib/silentRefresh";

const IDENTITY_BASE = (import.meta.env.VITE_IDENTITY_API_URL as string | undefined) ?? "";

// ---- API response types ----

interface LoginApiData {
  accessToken: string;
  csrfToken:   string;
  user: { user_id: string; email: string; role_id: string };
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: LoginApiData;
}

interface RefreshResponse {
  success: boolean;
  data: { accessToken: string; csrfToken: string };
}

interface RoleAccessItem {
  module_id: string;
  create: boolean; edit: boolean; view: boolean;
  delete: boolean; transfer: boolean; export: boolean;
}

interface ProfileData {
  _id: string; username: string; email: string;
  mobile_no: string; role_id: string; is_active: boolean;
  profile_image_url?: string | null;
  role: { _id: string; role_name: string; role_access: RoleAccessItem[] };
}

interface ProfileResponse {
  success: boolean;
  message: string;
  data: ProfileData;
}

// ---- Context types ----

type User = { id: string; name: string; email: string; role: string } | null;
type LoginBody = { email?: string; mobile?: string; password: string };

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading:       boolean;
  initDone:        boolean;
  user:            User;
  token:           string | null; // accessToken — kept as "token" for ProtectedRoute compat
  login:           (body: LoginBody) => Promise<void>;
  logout:          () => Promise<void>;
};

// ---- Pure helpers ----

function buildAccessMap(roleAccess: RoleAccessItem[]) {
  return roleAccess.reduce<Record<string, Omit<RoleAccessItem, "module_id">>>(
    (acc, { module_id, ...perms }) => { acc[module_id.toLowerCase()] = perms; return acc; },
    {}
  );
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Login failed";
}

// Raw axios with credentials — used for login/refresh (no interceptors to avoid loops)
const authAxios = axios.create({ baseURL: IDENTITY_BASE, withCredentials: true });

function callLoginApi(email: string, password: string) {
  return authAxios.post<LoginResponse>("/auth/login", { email, password });
}

function callRefreshApiRaw() {
  // rt httpOnly cookie is sent automatically by browser (withCredentials: true)
  return authAxios.post<RefreshResponse>("/auth/refresh", {});
}

function fetchProfileApi(accessToken: string) {
  return getData<ProfileResponse>({
    endpoint: "auth/profile",
    token: accessToken,
    instance: "identity",
  });
}

// ─── Rapid-refresh guard ──────────────────────────────────────────────────────
//
// PROBLEM: rapid F5 presses fire concurrent POST /auth/refresh calls that all
// carry the same (old) rt httpOnly cookie. The server uses refresh-token rotation
// with reuse detection:
//   • First  request → 200 OK, old rt invalidated, new rt issued.
//   • Second request → reuse of the already-invalidated old rt detected
//                    → server nukes the entire session AND the newly-issued rt.
//   • Third  request → uses the new rt, but the session is already dead → 401.
// Result: user is logged out by pressing F5 a few times quickly.
//
// FIX — two serialisation layers:
//   1. Module-level in-flight promise
//      Deduplicates calls that happen within the SAME page load
//      (e.g. React StrictMode double-mount in development).
//
//   2. sessionStorage "lock-until" timestamp
//      Serialises calls across CONSECUTIVE rapid page reloads.
//      sessionStorage survives F5 within the same browser tab, so page N+1 can
//      see that page N just started a refresh and should wait for it to settle.
//      Once the lock window expires the next legitimate load fires immediately.

let _refreshInFlight: ReturnType<typeof callRefreshApiRaw> | null = null;

const _RT_LOCK_KEY      = "__sc_rt_lock";
const _RT_COOLDOWN_MS   = 2000; // must be > expected max API response time (~500 ms)

function callRefreshApi(): ReturnType<typeof callRefreshApiRaw> {
  // Layer 1 — within-page dedup
  if (_refreshInFlight) return _refreshInFlight;

  // Layer 2 — cross-page cooldown
  let waitMs = 0;
  try {
    const lockUntil = Number(sessionStorage.getItem(_RT_LOCK_KEY) || 0);
    const now       = Date.now();
    waitMs          = Math.max(0, lockUntil - now);
    // Extend the lock window so the NEXT rapid page reload also waits
    sessionStorage.setItem(_RT_LOCK_KEY, String(Math.max(lockUntil, now) + _RT_COOLDOWN_MS));
  } catch { /* sessionStorage blocked (e.g. some private-mode browsers) — skip guard */ }

  _refreshInFlight = (async () => {
    if (waitMs > 0) {
      // Give the previous page's refresh request time to complete and the
      // browser to store the rotated rt cookie before we send our own call.
      await new Promise<void>(r => setTimeout(r, waitMs));
    }
    try {
      const result = await callRefreshApiRaw();
      // On success, clear the lock so a non-rapid refresh later isn't penalised
      try { sessionStorage.removeItem(_RT_LOCK_KEY); } catch { /* ignore */ }
      return result;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

// ---- Context ----

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const [isLoading, setIsLoading] = useState(false);
  const userData    = useSelector(selectUserData);
  const accessToken = useSelector(selectAccessToken); // null on every page refresh

  // initDone = false means "still checking if user has a valid session".
  // Starts false always because accessToken is never persisted.
  const [initDone, setInitDone] = useState(false);
  const initRef = useRef(false);

  const isAuthenticated = !!accessToken;

  const user = useMemo<User>(() => {
    if (!userData.user_id) return null;
    return {
      id:    userData.user_id,
      name:  userData.user_name  ?? "",
      email: userData.user_email ?? "",
      role:  userData.role_name  ?? "",
    };
  }, [userData.user_id, userData.user_name, userData.user_email, userData.role_name]);

  const applyProfile = useCallback(
    (profile: ProfileData) => {
      dispatch(setUserData({
        user_id:           profile._id,
        user_name:         profile.username,
        user_email:        profile.email,
        mobile_no:         profile.mobile_no,
        role_name:         profile.role.role_name,
        role_id:           profile.role_id,
        is_active:         profile.is_active,
        profile_image_url: profile.profile_image_url ?? null,
      }));
      dispatch(setAccessData(buildAccessMap(profile.role.role_access)));
    },
    [dispatch]
  );

  // On every page load: accessToken is null (not persisted).
  // Try POST /auth/refresh — if the rt httpOnly cookie is still valid, we get new tokens.
  // Then fetch profile to restore user/role data.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const refreshRes = await callRefreshApi();
        const { accessToken: newToken, csrfToken } = refreshRes.data.data;
        dispatch(setAuthTokens({ accessToken: newToken, csrfToken }));

        // Fetch full profile (role + permissions) — use the fresh token
        const profileRes = await fetchProfileApi(newToken);
        applyProfile(profileRes.data);
      } catch {
        // rt cookie missing or expired — user must log in
        clearAllAuthState();
      } finally {
        setInitDone(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async ({ email, password }: LoginBody) => {
      setIsLoading(true);
      try {
        const loginRes = await callLoginApi(email?.toLowerCase() ?? "", password);
        if (!loginRes.data?.data?.accessToken) {
          throw new Error(loginRes.data?.message || "Login failed");
        }

        const { accessToken: newToken, csrfToken } = loginRes.data.data;

        // Store tokens in Redux memory (not cookie, not localStorage)
        dispatch(setAuthTokens({ accessToken: newToken, csrfToken }));

        // Fetch full profile for role + module permissions
        const profileRes = await fetchProfileApi(newToken);
        applyProfile(profileRes.data);

        showToastnew.success(loginRes.data.message || "Login successful");
        navigate("/", { replace: true });
      } catch (err: unknown) {
        showToastnew.error(extractErrorMessage(err));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, applyProfile, navigate]
  );

  const logout = useCallback(async () => {
    try {
      // Tell the server to invalidate the session and clear the rt cookie
      await postData({ endpoint: "auth/logout", instance: "identity" });
    } catch {
      // Even if the API fails, clear local state
    } finally {
      clearAllAuthState();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      isLoading,
      initDone,
      user,
      token: accessToken,   // named "token" for ProtectedRoute / page compat
      login,
      logout,
    }),
    [isAuthenticated, isLoading, initDone, user, accessToken, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
