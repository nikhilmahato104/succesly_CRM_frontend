// silentRefresh.ts
// Handles the silent token refresh flow shared by all axios instances.
//
// FLOW:
//   Any 401 → call POST /auth/refresh (rt httpOnly cookie sent automatically)
//   → dispatch new accessToken + csrfToken to Redux
//   → retry the original failed request
//
// QUEUE: if multiple requests fail at the same time, they all wait for one
// refresh call instead of all hitting /auth/refresh simultaneously.

import axios, { AxiosRequestConfig } from "axios";
import { store } from "../store";
import { setAuthTokens, clearAuthTokens } from "../store/slices/authSlice";
import { clearUserData } from "../store/slices/userSlice";
import { clearAccessData } from "../store/slices/accessSlice";
import { clearApiKey } from "../store/slices/apiKeySlice";

const IDENTITY_BASE = (import.meta.env.VITE_IDENTITY_API_URL as string | undefined) ?? "";

// Dedicated axios instance for refresh — has NO interceptors, so no infinite loop.
const refreshAxios = axios.create({ baseURL: IDENTITY_BASE, withCredentials: true });

type QueueEntry = { resolve: (v: Tokens) => void; reject: (e: unknown) => void };
type Tokens = { accessToken: string; csrfToken: string };

let refreshing = false;
let queue: QueueEntry[] = [];

function drainQueue(tokens: Tokens) {
  queue.forEach(({ resolve }) => resolve(tokens));
  queue = [];
}

function rejectQueue(err: unknown) {
  queue.forEach(({ reject }) => reject(err));
  queue = [];
}

export function clearAllAuthState() {
  store.dispatch(clearAuthTokens());
  store.dispatch(clearUserData());
  store.dispatch(clearAccessData());
  store.dispatch(clearApiKey());
  // Clear legacy cookies (rt cookie is cleared by server on logout)
  try {
    document.cookie = "t=; Max-Age=0; path=/;";
    document.cookie = "auth_user=; Max-Age=0; path=/;";
    document.cookie = "uid=; Max-Age=0; path=/;";
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user_storage");
  } catch { /* ignore */ }
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
}

// Called when any protected axios instance receives a 401.
// Returns updated config with new tokens so the caller can retry.
export async function handleSilentRefresh(
  failedConfig: AxiosRequestConfig & { _retry?: boolean }
): Promise<AxiosRequestConfig> {
  if (failedConfig._retry) {
    // Already retried once — session is truly expired.
    clearAllAuthState();
    redirectToLogin();
    throw new Error("Session expired");
  }
  failedConfig._retry = true;

  if (refreshing) {
    // Another request is already refreshing — queue this one.
    return new Promise<AxiosRequestConfig>((resolve, reject) => {
      queue.push({
        resolve: (tokens: Tokens) => {
          if (failedConfig.headers) {
            failedConfig.headers["Authorization"] = `Bearer ${tokens.accessToken}`;
            if (["post", "put", "patch", "delete"].includes((failedConfig.method ?? "").toLowerCase())) {
              failedConfig.headers["x-csrf-token"] = tokens.csrfToken;
            }
          }
          resolve(failedConfig);
        },
        reject,
      });
    });
  }

  refreshing = true;
  try {
    const res = await refreshAxios.post<{ data: Tokens }>("/auth/refresh", {});
    const { accessToken, csrfToken } = res.data.data;

    store.dispatch(setAuthTokens({ accessToken, csrfToken }));
    drainQueue({ accessToken, csrfToken });

    // Update the failed request's headers with new tokens.
    if (failedConfig.headers) {
      failedConfig.headers["Authorization"] = `Bearer ${accessToken}`;
      if (["post", "put", "patch", "delete"].includes((failedConfig.method ?? "").toLowerCase())) {
        failedConfig.headers["x-csrf-token"] = csrfToken;
      }
    }
    return failedConfig;
  } catch (err) {
    rejectQueue(err);
    clearAllAuthState();
    redirectToLogin();
    throw err;
  } finally {
    refreshing = false;
  }
}
