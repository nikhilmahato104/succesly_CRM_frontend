// siteMaintenanceApi.ts — Site Maintenance API
//
// Uses identityInstance directly (not the crmServices helpers) so callers get the
// raw axios error: the form needs err.response.status === 409 and
// err.response.data.errors.existing_id to offer "edit the existing site instead".
// Auth, x-api-key and x-csrf-token headers are added by identityInstance's interceptor.

import identityInstance from "./crmServices/identityinstance";
import type {
  ApiResponse,
  PageResult,
  Site,
  SiteFilters,
  SitePayload,
  SiteStatus,
} from "../pages/site-maintenance/types";

const BASE = "site-maintenance";

/** Drops empty values so the query string stays clean */
function clean(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function fetchSites(
  filters: Partial<SiteFilters> & { page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<PageResult<Site>> {
  const res = await identityInstance.get<ApiResponse<PageResult<Site>>>(BASE, {
    params: clean(filters),
    signal,
  });
  return res.data.data;
}

export async function fetchSite(id: string): Promise<Site> {
  const res = await identityInstance.get<ApiResponse<Site>>(`${BASE}/${id}`);
  return res.data.data;
}

export async function createSite(payload: SitePayload): Promise<ApiResponse<Site>> {
  const res = await identityInstance.post<ApiResponse<Site>>(BASE, payload);
  return res.data;
}

/** The maintenance switch — also edits name / url / message / is_active */
export async function updateSite(id: string, payload: SitePayload): Promise<ApiResponse<Site>> {
  const res = await identityInstance.patch<ApiResponse<Site>>(`${BASE}/${id}`, payload);
  return res.data;
}

/** Hard delete — the url then reports as unregistered (live) */
export async function deleteSite(id: string): Promise<void> {
  await identityInstance.delete(`${BASE}/${id}`);
}

// ── Public status lookup (what the website itself calls) ───────────────────────

export async function checkSiteStatus(url: string): Promise<SiteStatus> {
  const res = await identityInstance.get<ApiResponse<SiteStatus>>(`${BASE}/status`, { params: { url } });
  return res.data.data;
}
