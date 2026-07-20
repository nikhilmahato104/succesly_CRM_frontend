import { getData, patchData, deleteData } from "./crmServices";
import type {
  DeviceInfoListResponse,
  DeviceInfoSingleResponse,
  DeviceInfoFilters,
} from "../pages/device-info/types";

const INSTANCE = "identity" as const;
const BASE     = "device-info";

// ── API 1 — List device-info records ────────────────────────────────────────────

export async function fetchDeviceInfos(
  filters: Partial<DeviceInfoFilters> & { page?: number; limit?: number },
): Promise<DeviceInfoListResponse> {
  const params: Record<string, unknown> = {};
  if (filters.page)         params.page         = filters.page;
  if (filters.limit)        params.limit        = filters.limit;
  if (filters.search)       params.search       = filters.search;
  if (filters.country)      params.country      = filters.country;
  if (filters.website_name) params.website_name = filters.website_name;
  if (filters.date_from)    params.date_from    = filters.date_from;
  if (filters.date_to)      params.date_to      = filters.date_to;

  return getData<DeviceInfoListResponse>({ endpoint: BASE, params, instance: INSTANCE });
}

// ── API 2 — Get single device-info record ───────────────────────────────────────

export async function fetchDeviceInfo(id: string): Promise<DeviceInfoSingleResponse> {
  return getData<DeviceInfoSingleResponse>({ endpoint: `${BASE}/${id}`, instance: INSTANCE });
}

// ── API 3 — Update (correct) a device-info record ───────────────────────────────

export async function updateDeviceInfo(
  id:      string,
  payload: Record<string, unknown>,
): Promise<DeviceInfoSingleResponse> {
  return patchData<DeviceInfoSingleResponse>({
    endpoint: `${BASE}/${id}`,
    data:     payload,
    instance: INSTANCE,
  });
}

// ── API 4 — Delete a device-info record ─────────────────────────────────────────

export async function deleteDeviceInfo(id: string): Promise<void> {
  await deleteData({ endpoint: `${BASE}/${id}`, instance: INSTANCE });
}
