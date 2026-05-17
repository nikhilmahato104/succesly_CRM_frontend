// // CRM axios instance
// import axios, { AxiosInstance } from "axios";

// const baseURL = import.meta.env.VITE_APP_API_URL as string | undefined;

// if (!baseURL) {
//   // Optional: warn early during local dev
//   // eslint-disable-next-line no-console
//   console.warn("VITE_APP_API_URL is not set");
// }

// const crminstance: AxiosInstance = axios.create({
//   baseURL: baseURL ?? "",
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// export default crminstance;







//08-oct-2025 logout when 401

// src/lib/axios.ts  (CRM axios instance)

import axios, { AxiosInstance } from "axios";
import { attachAuthInterceptor } from "../../lib/axiosAuthInterceptor";

const baseURL = (import.meta.env.VITE_APP_API_URL as string | undefined) ?? "";

if (!baseURL) {
  // Optional dev warning
  // eslint-disable-next-line no-console
  console.warn("VITE_APP_API_URL is not set");
}

const crminstance: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: false, // keep false if not using cookies
});

// attach interceptor once
attachAuthInterceptor(crminstance);

// TODO (backend step): Once the API adds x-device-id + x-session-nonce to
// Access-Control-Allow-Headers, add the same header injection here as in identityinstance.ts.

export default crminstance;
