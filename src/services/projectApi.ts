import { getData, postData, patchData, deleteData } from "./crmServices";
import type {
  ProjectListResponse,
  ProjectSingleResponse,
  ProjectFilters,
  CreateProjectPayload,
  AddTermPayload,
  MarkPaidPayload,
} from "../pages/project-management/types";

const INSTANCE = "identity" as const;
const BASE     = "projects";

// ── API 1 — List projects ──────────────────────────────────────────────────────

export async function fetchProjects(
  filters: Partial<ProjectFilters> & { page?: number; limit?: number; is_active?: boolean },
): Promise<ProjectListResponse> {
  const params: Record<string, unknown> = { is_active: true };
  if (filters.page)           params.page           = filters.page;
  if (filters.limit)          params.limit          = filters.limit;
  if (filters.search)         params.search         = filters.search;
  if (filters.project_status) params.project_status = filters.project_status;
  if (filters.project_type)   params.project_type   = filters.project_type;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  if (filters.date_from)      params.date_from      = filters.date_from;
  if (filters.date_to)        params.date_to        = filters.date_to;
  if (filters.is_active !== undefined) params.is_active = filters.is_active;

  return getData<ProjectListResponse>({ endpoint: BASE, params, instance: INSTANCE });
}

// ── API 2 — Get single project ─────────────────────────────────────────────────

export async function fetchProject(id: string): Promise<ProjectSingleResponse> {
  return getData<ProjectSingleResponse>({ endpoint: `${BASE}/${id}`, instance: INSTANCE });
}

// ── API 3 — Create project ─────────────────────────────────────────────────────

export async function createProject(
  payload: CreateProjectPayload,
): Promise<ProjectSingleResponse> {
  const res = await postData<ProjectSingleResponse>({
    endpoint: BASE,
    data:     payload,
    instance: INSTANCE,
  });
  return res.data;
}

// ── API 4 — Update project ─────────────────────────────────────────────────────

export async function updateProject(
  id:      string,
  payload: Partial<CreateProjectPayload> & { is_active?: boolean },
): Promise<ProjectSingleResponse> {
  return patchData<ProjectSingleResponse>({
    endpoint: `${BASE}/${id}`,
    data:     payload,
    instance: INSTANCE,
  });
}

// ── API 5 — Delete project ─────────────────────────────────────────────────────

export async function deleteProject(id: string): Promise<void> {
  await deleteData({ endpoint: `${BASE}/${id}`, instance: INSTANCE });
}

// ── API 6 — Add payment term ───────────────────────────────────────────────────

export async function addPaymentTerm(
  id:      string,
  payload: AddTermPayload,
): Promise<ProjectSingleResponse> {
  const res = await postData<ProjectSingleResponse>({
    endpoint: `${BASE}/${id}/payment-terms`,
    data:     payload,
    instance: INSTANCE,
  });
  return res.data;
}

// ── API 7 — Mark payment term paid ────────────────────────────────────────────

export async function markTermPaid(
  id:          string,
  termNumber:  number,
  payload:     MarkPaidPayload,
): Promise<ProjectSingleResponse> {
  return patchData<ProjectSingleResponse>({
    endpoint: `${BASE}/${id}/payment-terms/${termNumber}/pay`,
    data:     payload,
    instance: INSTANCE,
  });
}
