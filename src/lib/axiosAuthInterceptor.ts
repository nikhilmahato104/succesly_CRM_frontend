// axiosAuthInterceptor.ts
// In Secure Auth v2.0 the per-instance interceptors in identityinstance.ts and
// axios.ts handle 401 via silentRefresh.ts.
// This file is kept for any legacy imports but its helpers now delegate there.

import { clearAllAuthState } from "./silentRefresh";

export { clearAllAuthState as clearClientAuthState };

export function clearReduxAuthState() {
  // Handled inside clearAllAuthState()
}

export function redirectToLogin() {
  try {
    window.location.replace("/login");
  } catch {
    window.location.href = "/login";
  }
}

// attachAuthInterceptor is no longer needed — each instance has its own
// interceptor with silent-refresh support. Kept as a no-op for any legacy call sites.
import type { AxiosInstance } from "axios";
export function attachAuthInterceptor(_instance: AxiosInstance) {
  // no-op: replaced by per-instance interceptors in identityinstance.ts / axios.ts
}
