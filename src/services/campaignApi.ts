// campaignApi.ts — Campaign & Short Link API
//
// Uses identityInstance directly (not the crmServices helpers) so callers get the
// raw axios error: the create/update forms need err.response.status === 409 and
// err.response.data.errors.suggestions to handle "short URL name already taken".
// Auth, x-api-key and x-csrf-token headers are added by identityInstance's interceptor.

import identityInstance from "./crmServices/identityinstance";
import type {
  ApiResponse,
  PageResult,
  Campaign,
  CampaignPayload,
  CampaignFilters,
  CampaignAnalytics,
  OverviewAnalytics,
  CampaignClick,
  AnalyticsQuery,
  SlugCheckResult,
  Option,
} from "../pages/campaign-management/types";

const BASE = "campaigns";

/** Drops empty values so the query string stays clean */
function clean(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Form helpers ───────────────────────────────────────────────────────────────

export async function fetchIndustryTypes(): Promise<Option[]> {
  const res = await identityInstance.get<ApiResponse<Option[]>>(`${BASE}/industry-types`);
  return res.data.data;
}

export async function checkSlug(slug: string, excludeId?: string, signal?: AbortSignal): Promise<SlugCheckResult> {
  const res = await identityInstance.get<ApiResponse<SlugCheckResult>>(`${BASE}/check-slug`, {
    params: clean({ slug, exclude_id: excludeId }),
    signal,
  });
  return res.data.data;
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  filters: Partial<CampaignFilters> & { page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<PageResult<Campaign>> {
  // Archived campaigns are soft-deleted (is_active=false) — the list hides them unless asked
  const archived = filters.status === "archived";
  const res = await identityInstance.get<ApiResponse<PageResult<Campaign>>>(BASE, {
    params: clean({ ...filters, ...(archived && { is_active: false }) }),
    signal,
  });
  return res.data.data;
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  const res = await identityInstance.get<ApiResponse<Campaign>>(`${BASE}/${id}`);
  return res.data.data;
}

export async function createCampaign(payload: CampaignPayload): Promise<ApiResponse<Campaign>> {
  const res = await identityInstance.post<ApiResponse<Campaign>>(BASE, payload);
  return res.data;
}

export async function updateCampaign(id: string, payload: Partial<CampaignPayload>): Promise<ApiResponse<Campaign>> {
  const res = await identityInstance.patch<ApiResponse<Campaign>>(`${BASE}/${id}`, payload);
  return res.data;
}

/** Soft delete — the slug stays reserved and click history is kept */
export async function archiveCampaign(id: string): Promise<void> {
  await identityInstance.delete(`${BASE}/${id}`);
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export async function fetchCampaignAnalytics(id: string, query: AnalyticsQuery): Promise<CampaignAnalytics> {
  const res = await identityInstance.get<ApiResponse<CampaignAnalytics>>(`${BASE}/${id}/analytics`, {
    params: clean({ tz: browserTimezone(), ...query, include_bots: query.include_bots ? "true" : undefined }),
  });
  return res.data.data;
}

export async function fetchOverviewAnalytics(
  query: AnalyticsQuery & { industry_type?: string; utm_source?: string; utm_medium?: string },
): Promise<OverviewAnalytics> {
  const res = await identityInstance.get<ApiResponse<OverviewAnalytics>>(`${BASE}/analytics/overview`, {
    params: clean({ tz: browserTimezone(), ...query, include_bots: query.include_bots ? "true" : undefined }),
  });
  return res.data.data;
}

export async function fetchCampaignClicks(
  id: string,
  query: { page: number; limit: number; from?: string; to?: string },
): Promise<PageResult<CampaignClick>> {
  const res = await identityInstance.get<ApiResponse<PageResult<CampaignClick>>>(`${BASE}/${id}/clicks`, {
    params: clean(query),
  });
  return res.data.data;
}
