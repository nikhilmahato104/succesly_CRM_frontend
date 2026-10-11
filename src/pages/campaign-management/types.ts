import type { CSSProperties } from "react";

// ── Module ─────────────────────────────────────────────────────────────────────

export const CAMPAIGN_MODULE_ID = "campaign_and_short_url_management";

// ── Enums ──────────────────────────────────────────────────────────────────────

export type CampaignStatus = "active" | "paused" | "archived";
export type AnalyticsInterval = "hour" | "day" | "week" | "month";

// ── Entities ───────────────────────────────────────────────────────────────────

export interface UtmParams {
  utm_source:           string;
  utm_medium:           string;
  utm_campaign:         string;
  utm_term?:            string;
  utm_content?:         string;
  utm_id?:              string;
  utm_source_platform?: string;
}

export interface CustomParam {
  key:   string;
  value: string;
}

// Type alias (not interface) so it satisfies CustomDatagrid's Record<string, unknown> constraint
export type Campaign = {
  _id:              string;
  reference_id:     string;
  name:             string;
  description?:     string;
  industry_type:    string;
  destination_url:  string;
  utm:              UtmParams;
  custom_params:    CustomParam[];
  final_url:        string;
  slug:             string;
  short_url:        string;   // https://<slug>.succesly.in — needs wildcard DNS
  short_url_path:   string;   // https://api.succesly.in/r/<slug> — always works
  tags:             string[];
  status:           CampaignStatus;
  start_date?:      string;
  expires_at?:      string;
  fallback_url?:    string;
  total_clicks:     number;
  unique_clicks:    number;
  bot_clicks:       number;
  last_clicked_at?: string;
  is_active:        boolean;
  createdAt?:       string;
  updatedAt?:       string;
};

export interface CampaignPayload {
  name:            string;
  description?:    string;
  industry_type:   string;
  destination_url: string;
  utm:             UtmParams;
  custom_params?:  CustomParam[];
  slug?:           string;
  tags?:           string[];
  status?:         "active" | "paused";
  start_date?:     string | null;
  expires_at?:     string | null;
  fallback_url?:   string | null;
}

export interface SlugCheckResult {
  slug:        string;
  available:   boolean;
  reason?:     string;
  suggestions: string[];
}

export interface Option {
  value: string;
  label: string;
}

// ── API envelopes ──────────────────────────────────────────────────────────────

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

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface BreakdownRow {
  key:           string;
  clicks:        number;
  unique_clicks: number;
}

export interface TimelineRow {
  period:        string;
  clicks:        number;
  unique_clicks: number;
}

export interface AnalyticsSummary {
  total_clicks:    number;
  unique_clicks:   number;
  unique_visitors: number;
  first_click_at:  string | null;
  last_click_at:   string | null;
  bot_clicks?:     number;
}

export interface AnalyticsQuery {
  from?:         string;
  to?:           string;
  interval?:     AnalyticsInterval;
  include_bots?: boolean;
  tz?:           string;
}

export interface CampaignAnalytics {
  campaign: Pick<Campaign, "_id" | "name" | "slug" | "reference_id" | "industry_type" | "status" | "utm" | "final_url" | "short_url" | "short_url_path">;
  summary:        AnalyticsSummary;
  timeline:       TimelineRow[];
  by_device:      BreakdownRow[];
  by_browser:     BreakdownRow[];
  by_os:          BreakdownRow[];
  by_country:     BreakdownRow[];
  by_city:        BreakdownRow[];
  by_referrer:    BreakdownRow[];
  by_language:    BreakdownRow[];
  by_access_type: BreakdownRow[];
  by_hour_of_day: { hour: number; clicks: number }[];
  by_day_of_week: { day_number: number; day: string; clicks: number }[];
}

export interface OverviewAnalytics {
  summary:               AnalyticsSummary;
  campaigns_by_industry: {
    industry_type:           string;
    campaigns:               number;
    active:                  number;
    total_clicks:            number;
    unique_clicks:           number;
    avg_clicks_per_campaign: number;
  }[];
  timeline:        TimelineRow[];
  by_industry:     BreakdownRow[];
  by_utm_source:   BreakdownRow[];
  by_utm_medium:   BreakdownRow[];
  by_utm_campaign: BreakdownRow[];
  by_device:       BreakdownRow[];
  by_browser:      BreakdownRow[];
  by_os:           BreakdownRow[];
  by_country:      BreakdownRow[];
  by_hour_of_day:  { hour: number; clicks: number }[];
  top_campaigns: {
    campaign_id:   string;
    clicks:        number;
    unique_clicks: number;
    name?:         string;
    slug?:         string;
    industry_type?: string;
    utm_source?:   string;
    utm_medium?:   string;
  }[];
}

export interface CampaignClick {
  _id:              string;
  visitor_id:       string;
  is_unique:        boolean;
  is_bot:           boolean;
  ip?:              string;
  device_type:      string;
  browser:          string;
  browser_version?: string;
  os:               string;
  os_version?:      string;
  referrer_domain?: string;
  country?:         string;
  city?:            string;
  language?:        string;
  access_type:      "subdomain" | "path";
  clicked_at:       string;
}

// ── List filters ───────────────────────────────────────────────────────────────

export interface CampaignFilters {
  search:        string;
  industry_type: string;
  status:        string;
  utm_source:    string;
  sort_by:       string;
  sort_order:    "asc" | "desc";
}

export const EMPTY_FILTERS: CampaignFilters = {
  search:        "",
  industry_type: "",
  status:        "",
  utm_source:    "",
  sort_by:       "createdAt",
  sort_order:    "desc",
};

export const STATUS_OPTIONS: Option[] = [
  { value: "active",   label: "Active"   },
  { value: "paused",   label: "Paused"   },
  { value: "archived", label: "Archived" },
];

export const SORT_OPTIONS: Option[] = [
  { value: "createdAt",       label: "Newest"         },
  { value: "total_clicks",    label: "Most clicks"    },
  { value: "unique_clicks",   label: "Most unique"    },
  { value: "last_clicked_at", label: "Last clicked"   },
  { value: "name",            label: "Name"           },
];

export const INTERVAL_OPTIONS: Option[] = [
  { value: "hour",  label: "Hourly"  },
  { value: "day",   label: "Daily"   },
  { value: "week",  label: "Weekly"  },
  { value: "month", label: "Monthly" },
];

export const STATUS_STYLE: Record<CampaignStatus, CSSProperties> = {
  active:   { background: "var(--badge-green-bg)", color: "var(--badge-green-text)" },
  paused:   { background: "var(--badge-amber-bg)", color: "var(--badge-amber-text)" },
  archived: { background: "var(--badge-gray-bg)",  color: "var(--badge-gray-text)"  },
};

export const MAX_CUSTOM_PARAMS = 5;
export const SLUG_MIN_LENGTH   = 3;
export const SLUG_MAX_LENGTH   = 40;

// ── Short-link domain ──────────────────────────────────────────────────────────
// Shown as the suffix of the slug input. Override with VITE_SHORT_LINK_DOMAIN;
// otherwise derived from the API host: api.succesly.in → succesly.in, localhost:7000 stays.

export const SHORT_LINK_DOMAIN: string = (() => {
  const explicit = import.meta.env.VITE_SHORT_LINK_DOMAIN as string | undefined;
  if (explicit) return explicit;
  try {
    const host = new URL(import.meta.env.VITE_IDENTITY_API_URL as string).host;
    return host.replace(/^api\./, "");
  } catch {
    return "succesly.in";
  }
})();

// ── Helpers ────────────────────────────────────────────────────────────────────

export const labelFor = (options: Option[], value?: string) =>
  options.find((o) => o.value === value)?.label ?? humanize(value);

/** "real_estate" → "Real Estate" */
export const humanize = (value?: string) =>
  (value ?? "").split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

export const formatNumber = (n?: number) => (n ?? 0).toLocaleString("en-IN");

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** ISO → value for <input type="datetime-local"> in local time */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO string (or null when empty) */
export const fromLocalInput = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

/** YYYY-MM-DD in local time */
export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Same order the backend uses, so the preview matches final_url */
const UTM_ORDER: (keyof UtmParams)[] = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_source_platform",
];

/** Client-side preview of final_url — destination + UTM + custom params */
export function buildPreviewUrl(destination: string, utm: Partial<UtmParams>, custom: CustomParam[]): string {
  let url: URL;
  try {
    url = new URL(destination.trim());
  } catch {
    return "";
  }
  UTM_ORDER.forEach((k) => {
    const v = utm[k]?.trim();
    if (v) url.searchParams.set(k, v);
  });
  custom.forEach(({ key, value }) => {
    if (key.trim() && value.trim()) url.searchParams.set(key.trim(), value.trim());
  });
  return url.toString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (http on a LAN IP)
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity  = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

/** Pulls a user-facing message out of an axios error */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: unknown } } })?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) return data.errors.join(", ");
  return data?.message || fallback;
}

// ── Timeline gap filling ───────────────────────────────────────────────────────
// The API omits periods with zero clicks. These builders produce every period key
// between `from` and `to` in the same format the backend uses, so charts show 0s.

const pad2 = (n: number) => String(n).padStart(2, "0");

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad2(week)}`;
}

function periodKey(d: Date, interval: AnalyticsInterval): string {
  const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (interval === "hour")  return `${ymd} ${pad2(d.getHours())}:00`;
  if (interval === "week")  return isoWeekKey(d);
  if (interval === "month") return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  return ymd;
}

export function fillTimeline(rows: TimelineRow[], from: string, to: string, interval: AnalyticsInterval): TimelineRow[] {
  if (!from || !to) return rows;
  const start = new Date(`${from}T00:00:00`);
  const end   = new Date(`${to}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return rows;

  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  const keys: string[] = [];
  const cursor = new Date(start);
  // Hard cap keeps a huge hourly range from freezing the tab
  while (cursor <= end && keys.length < 2000) {
    const key = periodKey(cursor, interval);
    if (keys[keys.length - 1] !== key) keys.push(key);
    if (interval === "hour") cursor.setHours(cursor.getHours() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  // Keep any period the server returned that falls outside the generated range (timezone edges)
  rows.forEach((r) => { if (!keys.includes(r.period)) keys.push(r.period); });
  keys.sort();

  return keys.map((k) => byPeriod.get(k) ?? { period: k, clicks: 0, unique_clicks: 0 });
}
