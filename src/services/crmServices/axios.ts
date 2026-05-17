// axios.ts — CRM instance — Secure Auth v2.0
// Same interceptor pattern as identityinstance.ts:
//   Request  → inject Authorization + x-csrf-token + x-api-key from Redux
//   Response → 401 triggers silent refresh + retry

import axios, { AxiosInstance } from "axios";
import { store } from "../../store";
import { handleSilentRefresh } from "../../lib/silentRefresh";

const baseURL = (import.meta.env.VITE_APP_API_URL as string | undefined) ?? "";

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.warn("VITE_APP_API_URL is not set");
}

const crminstance: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // sends rt httpOnly cookie automatically
});

// ── Request interceptor ──────────────────────────────────────────────────────
crminstance.interceptors.request.use((config) => {
  const state = store.getState();

  const accessToken = state.auth?.accessToken;
  const csrfToken   = state.auth?.csrfToken;
  const apiKey      = state.apiKey?.key;

  if (accessToken && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const method = (config.method ?? "").toLowerCase();
  if (csrfToken && ["post", "put", "patch", "delete"].includes(method)) {
    config.headers["x-csrf-token"] = csrfToken;
  }

  if (apiKey) config.headers["x-api-key"] = apiKey;

  return config;
});

// ── Response interceptor: 401 → silent refresh + retry ──────────────────────
crminstance.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    if (error?.response?.status !== 401) return Promise.reject(error);

    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    if (currentPath.startsWith("/login")) return Promise.reject(error);

    try {
      const retryConfig = await handleSilentRefresh(error.config ?? {});
      return crminstance(retryConfig);
    } catch {
      return Promise.reject(error);
    }
  }
);

export default crminstance;
