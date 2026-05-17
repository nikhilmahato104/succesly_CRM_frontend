import axios, { AxiosInstance, AxiosError } from "axios";
import { store } from "../../store";
import { openApiKeyModal, clearApiKey } from "../../store/slices/apiKeySlice";
import { clearUserData } from "../../store/slices/userSlice";
import { clearAccessData } from "../../store/slices/accessSlice";
import { showToastnew } from "../toastifynewService/toastifynewService";
import { clearClientAuthState, redirectToLogin } from "../../lib/axiosAuthInterceptor";

const identityBaseURL = (import.meta.env.VITE_IDENTITY_API_URL as string | undefined) ?? "";

if (!identityBaseURL) {
  // eslint-disable-next-line no-console
  console.warn("VITE_IDENTITY_API_URL is not set");
}

const identityInstance: AxiosInstance = axios.create({
  baseURL: identityBaseURL,
  headers: { "Content-Type": "application/json" },
});

// Inject API key on every request.
// TODO (backend step): Once the API adds x-device-id + x-session-nonce to
// Access-Control-Allow-Headers, uncomment the two lines below to enable
// session binding and prevent cookie-sharing attacks.
identityInstance.interceptors.request.use((config) => {
  const apiKey = store.getState().apiKey?.key;
  if (apiKey) config.headers["x-api-key"] = apiKey;

  // const deviceId = localStorage.getItem("_did");
  // const sessionNonce = sessionStorage.getItem("_sn");
  // if (deviceId) config.headers["x-device-id"] = deviceId;
  // if (sessionNonce) config.headers["x-session-nonce"] = sessionNonce;

  return config;
});

// ---- Error classifiers ----

function isMissingKey(msg: string): boolean {
  return msg.toLowerCase().includes("api key is required");
}

function isInvalidKey(msg: string): boolean {
  return msg.toLowerCase().includes("invalid api key");
}

function isKeyLimitExceeded(msg: string): boolean {
  return msg.toLowerCase().includes("api key usage limit exceeded");
}

// ---- Shared clear helper ----

function clearAllState(): void {
  store.dispatch(clearUserData());
  store.dispatch(clearAccessData());
  store.dispatch(clearApiKey());
  clearClientAuthState();
}

function handleInvalidKeyError(msg: string): void {
  showToastnew.error(msg || "Invalid API key");
  clearAllState();
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  if (!currentPath.startsWith("/login")) {
    redirectToLogin();
  }
}

// ---- Response interceptor — handles ALL identity auth cases ----
// NOTE: attachAuthInterceptor is intentionally NOT used here.
// The identity service has its own 3-case logic:
//   1. API key missing   → show the API key modal
//   2. API key invalid   → toast + clear everything + redirect to /login
//   3. Other 401 (JWT)   → clear everything + redirect to /login

identityInstance.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    const data = error.response?.data as { message?: string } | undefined;
    const msg = data?.message ?? "";

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
      handleInvalidKeyError(msg);
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      clearAllState();
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      if (!currentPath.startsWith("/login")) {
        redirectToLogin();
      }
    }

    return Promise.reject(error);
  }
);

export default identityInstance;
