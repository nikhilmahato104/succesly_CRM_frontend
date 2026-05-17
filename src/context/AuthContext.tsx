import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import { useDispatch, useSelector } from "react-redux";

import { postData, getData } from "../services/crmServices";
import { showToastnew } from "../services/toastifynewService/toastifynewService";
import { setUserData, clearUserData, selectUserData } from "../store/slices/userSlice";
import { setAccessData, clearAccessData } from "../store/slices/accessSlice";
import { clearApiKey } from "../store/slices/apiKeySlice";

// ---- API response types ----

interface LoginApiData {
  token: string;
  user: { user_id: string; email: string; role_id: string };
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: LoginApiData;
}

interface RoleAccessItem {
  module_id: string;
  create: boolean;
  edit: boolean;
  view: boolean;
  delete: boolean;
  transfer: boolean;
  export: boolean;
}

interface ProfileData {
  _id: string;
  username: string;
  email: string;
  mobile_no: string;
  role_id: string;
  is_active: boolean;
  role: {
    _id: string;
    role_name: string;
    role_access: RoleAccessItem[];
  };
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
  isLoading: boolean;
  initDone: boolean;
  user: User;
  token: string | null;
  login: (body: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
};

// ---- Pure helpers ----

const COOKIE_OPTIONS = {
  path: "/",
  sameSite: "strict" as const,
  ...(import.meta.env.PROD ? { secure: true } : {}),
};

// Decode JWT payload and check exp claim — returns true if token is past expiry.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true; // treat malformed token as expired
  }
}

function buildAccessMap(roleAccess: RoleAccessItem[]) {
  return roleAccess.reduce<Record<string, Omit<RoleAccessItem, "module_id">>>(
    (acc, { module_id, ...perms }) => {
      acc[module_id.toLowerCase()] = perms;
      return acc;
    },
    {}
  );
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Login failed";
}

function callLoginApi(email: string, password: string) {
  return postData<LoginResponse>({
    endpoint: "auth/login",
    data: { email, password },
    instance: "identity",
  });
}

function fetchProfileApi(token: string) {
  return getData<ProfileResponse>({
    endpoint: "auth/profile",
    token,
    instance: "identity",
  });
}

// ---- Context ----

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [cookies, setCookie, removeCookie] = useCookies(["t"]);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const userData = useSelector(selectUserData);
  const rawToken = cookies?.t ? String(cookies.t) : null;
  // Treat expired tokens as absent — avoids a 401 round-trip on next render.
  const token = rawToken && !isTokenExpired(rawToken) ? rawToken : null;
  const isAuthenticated = !!token;

  // On page refresh the Redux store is empty even though the cookie still exists.
  // We track whether the init fetch is in flight so ProtectedRoute waits for it.
  const [initDone, setInitDone] = useState(!token); // if no token, nothing to init
  const initRef = useRef(false);

  const user = useMemo<User>(() => {
    if (!userData.user_id) return null;
    return {
      id: userData.user_id,
      name: userData.user_name ?? "",
      email: userData.user_email ?? "",
      role: userData.role_name ?? "",
    };
  }, [userData.user_id, userData.user_name, userData.user_email, userData.role_name]);

  const applyProfile = useCallback(
    (profile: ProfileData) => {
      dispatch(
        setUserData({
          user_id: profile._id,
          user_name: profile.username,
          user_email: profile.email,
          mobile_no: profile.mobile_no,
          role_name: profile.role.role_name,
          role_id: profile.role_id,
          is_active: profile.is_active,
        })
      );
      dispatch(setAccessData(buildAccessMap(profile.role.role_access)));
    },
    [dispatch]
  );

  // Run once on mount: if token exists but Redux store is empty (page refresh),
  // re-fetch the profile so role/access data is restored before any route check.
  useEffect(() => {
    if (!token || userData.user_id || initRef.current) {
      // If cookie exists but token is expired, remove the stale cookie.
      if (rawToken && !token) removeCookie("t", { path: "/" });
      setInitDone(true);
      return;
    }
    initRef.current = true;
    setIsLoading(true);
    fetchProfileApi(token)
      .then((res) => applyProfile(res.data))
      .catch(() => {
        removeCookie("t", { path: "/" });
      })
      .finally(() => {
        setIsLoading(false);
        setInitDone(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async ({ email, password }: LoginBody) => {
      setIsLoading(true);
      try {
        const { data: loginResult } = await callLoginApi(email?.toLowerCase() ?? "", password);
        if (!loginResult.data?.token) throw new Error(loginResult.message || "Login failed");

        const tok = loginResult.data.token;
        setCookie("t", tok, COOKIE_OPTIONS);

        const profileResult = await fetchProfileApi(tok);
        applyProfile(profileResult.data);

        showToastnew.success(loginResult.message || "Login successful");
        navigate("/", { replace: true });
      } catch (err: unknown) {
        showToastnew.error(extractErrorMessage(err));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setCookie, applyProfile, navigate]
  );

  const logout = useCallback(async () => {
    dispatch(clearUserData());
    dispatch(clearAccessData());
    dispatch(clearApiKey());
    removeCookie("t", { path: "/" });
    navigate("/login", { replace: true });
  }, [dispatch, removeCookie, navigate]);

  const value = useMemo<AuthContextType>(
    () => ({ isAuthenticated, isLoading, initDone, user, token, login, logout }),
    [isAuthenticated, isLoading, initDone, user, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
