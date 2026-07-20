// ── Data models ────────────────────────────────────────────────────────────────

export interface WebsiteUrlRoute {
  url:          string;
  hit_count:    number;
  created_at:   string;
  last_hit_at:  string;
}

export interface DeviceInfo {
  _id:                     string;
  reference_id:            string;
  frontend_generated_uuid: string;
  device_number?:          string | null;
  device_name?:            string | null;
  device_change:           number;
  device_ip?:              string | null;
  country?:                string | null;
  lat?:                    number | null;
  long?:                   number | null;
  website_name?:           string | null;
  website_all_url_route:   WebsiteUrlRoute[];
  is_active:               boolean;
  createdAt:               string;
  updatedAt:               string;
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface DeviceInfoListResponse {
  success: boolean;
  message: string;
  data: {
    data:       DeviceInfo[];
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}

export interface DeviceInfoSingleResponse {
  success: boolean;
  message: string;
  data:    DeviceInfo;
}

// ── List filter state ──────────────────────────────────────────────────────────

export interface DeviceInfoFilters {
  search:       string;
  country:      string;
  website_name: string;
  date_from:    string;
  date_to:      string;
}

export const EMPTY_FILTERS: DeviceInfoFilters = {
  search:       "",
  country:      "",
  website_name: "",
  date_from:    "",
  date_to:      "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function totalHits(row: DeviceInfo): number {
  return row.website_all_url_route.reduce((sum, r) => sum + (r.hit_count ?? 0), 0);
}
