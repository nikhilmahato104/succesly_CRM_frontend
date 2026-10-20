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

import axios, { AxiosInstance, AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
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

// ── GET response cache ───────────────────────────────────────────────────────
// Module pages switch like an app (keep-alive + swipe). Even if a page has to
// remount (hot reload, a sub-page visit), the same GET within GET_TTL_MS is
// answered from memory — no repeat API call. Any write (POST/PUT/PATCH/DELETE)
// clears the cache, so lists are fresh after create / edit / delete.
// The key includes the Authorization + x-api-key headers, so another session
// or a refreshed token never reads someone else's cached data.

const GET_TTL_MS = 5 * 60 * 1000;
const getCache   = new Map<string, { at: number; response: AxiosResponse }>();

/** Drop every cached GET — e.g. a manual "refresh" that must hit the server */
export const clearGetCache = (): void => getCache.clear();

const networkAdapter = axios.getAdapter(identityInstance.defaults.adapter);

identityInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get") {
    getCache.clear();                       // any write may change any list
    return networkAdapter(config);
  }

  const key = [
    String(config.headers?.["Authorization"] ?? ""),
    String(config.headers?.["x-api-key"] ?? ""),
    identityInstance.getUri(config),        // url + serialized params
  ].join(" ");

  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_TTL_MS) {
    if (config.signal?.aborted) throw new axios.CanceledError(undefined, undefined, config);
    return { ...hit.response, config };
  }

  const response = await networkAdapter(config);
  if (response.status >= 200 && response.status < 300) getCache.set(key, { at: Date.now(), response });
  return response;
};

export default identityInstance;
