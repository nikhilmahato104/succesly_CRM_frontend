import type { CSSProperties } from "react";

// ── Module ─────────────────────────────────────────────────────────────────────

export const SITE_MAINTENANCE_MODULE_ID = "site_maintenance";

// ── API shapes ─────────────────────────────────────────────────────────────────

// Type alias (not interface) so it satisfies CustomDatagrid's Record<string, unknown> constraint
export type Site = {
  _id:                 string;
  reference_id:        string;
  site_name:           string;
  site_url:            string;   // stored exactly as typed — what the dashboard shows
  normalized_url:      string;   // what GET /site-maintenance/status matches on
  site_host:           string;
  is_maintenance_mode: boolean;
  maintenance_message: string;
  created_by?:         string;
  is_active:           boolean;
  createdAt?:          string;
  updatedAt?:          string;
};

export interface SitePayload {
  site_name?:           string;
  site_url?:            string;
  is_maintenance_mode?: boolean;
  /** "" resets it to the server's default wording */
  maintenance_message?: string;
  /** false retires the record — the status lookup then ignores it */
  is_active?:           boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data:    T;
}

export interface PageResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

/** GET /site-maintenance/status — public lookup */
export interface SiteStatus {
  requested_url:       string;
  normalized_url:      string;
  registered:          boolean;
  matched_by?:         "exact" | "host";
  is_maintenance_mode: boolean;
  maintenance_message?: string;
  site_name?:          string;
  site_url?:           string;
  reference_id?:       string;
}

/** 409 body on create/update — the url belongs to another record */
export interface DuplicateSiteError {
  normalized_url: string;
  existing_id:    string;
}

// ── Filters ────────────────────────────────────────────────────────────────────

export interface SiteFilters {
  search:              string;
  is_maintenance_mode: "" | "true" | "false";
  is_active:           "true" | "false";
}

export const EMPTY_FILTERS: SiteFilters = {
  search:              "",
  is_maintenance_mode: "",
  is_active:           "true",
};

export const MODE_OPTIONS = [
  { value: "true",  label: "Under maintenance" },
  { value: "false", label: "Live" },
];

export const RECORD_OPTIONS = [
  { value: "true",  label: "Active records" },
  { value: "false", label: "Deactivated records" },
];

// ── Display ────────────────────────────────────────────────────────────────────

export const MODE_STYLE: Record<"down" | "live" | "inactive", CSSProperties> = {
  down:     { background: "var(--badge-amber-bg)", color: "var(--badge-amber-text)" },
  live:     { background: "var(--badge-green-bg)", color: "var(--badge-green-text)" },
  inactive: { background: "var(--badge-gray-bg)",  color: "var(--badge-gray-text)"  },
};

export const modeKey = (s: Pick<Site, "is_active" | "is_maintenance_mode">) =>
  !s.is_active ? "inactive" : s.is_maintenance_mode ? "down" : "live";

export const MODE_LABEL: Record<ReturnType<typeof modeKey>, string> = {
  down:     "Maintenance",
  live:     "Live",
  inactive: "Deactivated",
};

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Client-side preview of the server's url normalisation, so the form can show
 * what a url will be matched as. Mirrors the documented rules: drop protocol,
 * leading www., query, hash and trailing slash; lower-case; keep the port.
 * The server stays the source of truth — this is only a hint.
 */
export function normalizeSiteUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: unknown } } })?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) return data.errors.join(", ");
  return data?.message || fallback;
}

/** Pulls { existing_id } out of a 409 "already registered" response, if that is what this is */
export function duplicateSiteError(err: unknown): (DuplicateSiteError & { message: string }) | null {
  const res = (err as { response?: { status?: number; data?: { message?: string; errors?: Partial<DuplicateSiteError> } } })?.response;
  if (res?.status !== 409 || !res.data?.errors?.existing_id) return null;
  return {
    message:        res.data.message ?? "This site is already registered",
    normalized_url: res.data.errors.normalized_url ?? "",
    existing_id:    res.data.errors.existing_id,
  };
}
