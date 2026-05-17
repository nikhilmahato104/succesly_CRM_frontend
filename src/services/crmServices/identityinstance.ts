// identityinstance.ts — Secure Auth v2.0
//
// REQUEST INTERCEPTOR:
//   • Authorization: Bearer <accessToken>  — on every request (from Redux)
//   • x-csrf-token: <csrfToken>            — on POST / PUT / PATCH / DELETE
//   • x-api-key                            — from Redux apiKey slice
//
// RESPONSE INTERCEPTOR:
//   • 401 → call silentRefresh → update Redux → retry original request
//   • If refresh also fails → clearAllAuthState → redirect to /login

import axios, { AxiosInstance, AxiosError } from "axios";
import { store } from "../../store";
import { openApiKeyModal, clearApiKey } from "../../store/slices/apiKeySlice";
import { showToastnew } from "../toastifynewService/toastifynewService";
import { handleSilentRefresh, clearAllAuthState } from "../../lib/silentRefresh";

const identityBaseURL = (import.meta.env.VITE_IDENTITY_API_URL as string | undefined) ?? "";

if (!identityBaseURL) {
  // eslint-disable-next-line no-console
  console.warn("VITE_IDENTITY_API_URL is not set");
}

const identityInstance: AxiosInstance = axios.create({
  baseURL: identityBaseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // required: sends rt httpOnly cookie automatically
});

// ── Request interceptor ──────────────────────────────────────────────────────
// Injects Authorization, x-csrf-token, and x-api-key on every outgoing request.
identityInstance.interceptors.request.use((config) => {
  const state = store.getState();

  const accessToken = state.auth?.accessToken;
  const csrfToken   = state.auth?.csrfToken;
  const apiKey      = state.apiKey?.key;

  // Authorization header — only if not already explicitly set
  if (accessToken && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // CSRF header — only on state-changing methods
  const method = (config.method ?? "").toLowerCase();
  if (csrfToken && ["post", "put", "patch", "delete"].includes(method)) {
    config.headers["x-csrf-token"] = csrfToken;
  }

  if (apiKey) config.headers["x-api-key"] = apiKey;

  return config;
});

// ── Error classifiers ────────────────────────────────────────────────────────

function isMissingKey(msg: string)   { return msg.toLowerCase().includes("api key is required"); }
function isInvalidKey(msg: string)   { return msg.toLowerCase().includes("invalid api key"); }
function isKeyLimitExceeded(msg: string) { return msg.toLowerCase().includes("api key usage limit exceeded"); }

// ── Response interceptor ─────────────────────────────────────────────────────

identityInstance.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const data = error.response?.data as { message?: string } | undefined;
    const msg  = data?.message ?? "";
    const status = error.response?.status;

    // ── API key errors ───────────────────────────────────────────────────────
    if (isMissingKey(msg)) {
      store.dispatch(openApiKeyModal(false));
      return Promise.reject(error);
    }

    if (isKeyLimitExceeded(msg)) {
      showToastnew.error("API key usage limit exceeded. Please enter a new API key.");
      store.dispatch(clearApiKey());
      store.dispatch(openApiKeyModal("limit_exceeded"));
      return Promise.reject(error);
    }

    if (isInvalidKey(msg)) {
      showToastnew.error(msg || "Invalid API key");
      clearAllAuthState();
      return Promise.reject(error);
    }

    // ── 401 → silent refresh + retry ─────────────────────────────────────────
    if (status === 401) {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      if (currentPath.startsWith("/login")) return Promise.reject(error);

      try {
        const retryConfig = await handleSilentRefresh(error.config ?? {});
        return identityInstance(retryConfig);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default identityInstance;
