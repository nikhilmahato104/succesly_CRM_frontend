import { getData } from "./crmServices";

const INSTANCE = "identity" as const;
const BASE      = "activity-logs";

export interface ActivityLogChange {
  field: string;
  from:  unknown;
  to:    unknown;
}

export interface ActivityLogItem {
  _id:             string;
  user_id:         string;
  user_email:      string;
  action:          string;
  module:          string;
  entity_id:       string;
  entity_ref:      string;
  description:     string;
  changes:         ActivityLogChange[];
  method:          string;
  endpoint:        string;
  status_code:     number;
  is_success:      boolean;
  response_time_ms:number;
  ip_address:      string;
  createdAt:       string;
}

export interface ActivityLogListResponse {
  success: boolean;
  message: string;
  data: {
    data:        ActivityLogItem[];
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
  };
}

export interface ActivityLogSummary {
  total:     number;
  by_action: Array<{ _id: string; count: number }>;
  by_module: Array<{ _id: string; count: number }>;
}

export interface ActivityLogSummaryResponse {
  success: boolean;
  message: string;
  data:    ActivityLogSummary;
}

export async function fetchActivityLogs(
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ActivityLogListResponse> {
  return getData<ActivityLogListResponse>({ endpoint: BASE, params, instance: INSTANCE, signal });
}

export async function fetchActivityLogById(id: string): Promise<{ success: boolean; data: ActivityLogItem }> {
  return getData<{ success: boolean; data: ActivityLogItem }>({ endpoint: `${BASE}/${id}`, instance: INSTANCE });
}

export async function fetchActivityLogSummary(
  params?: Record<string, unknown>,
): Promise<ActivityLogSummaryResponse> {
  return getData<ActivityLogSummaryResponse>({ endpoint: `${BASE}/summary`, params, instance: INSTANCE });
}
