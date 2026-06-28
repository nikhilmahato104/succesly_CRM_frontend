// ── Enum constants ─────────────────────────────────────────────────────────────

export const PROJECT_TYPE_OPTIONS = [
  { value: "salon",             label: "Salon" },
  { value: "gym",               label: "Gym" },
  { value: "spa",               label: "Spa" },
  { value: "legal",             label: "Legal" },
  { value: "hospital",          label: "Hospital" },
  { value: "school_management", label: "School Management" },
  { value: "ecommerce",         label: "E-Commerce" },
  { value: "real_estate",       label: "Real Estate" },
  { value: "restaurant",        label: "Restaurant" },
  { value: "hotel",             label: "Hotel" },
  { value: "travel",            label: "Travel" },
  { value: "finance",           label: "Finance" },
  { value: "inventory",         label: "Inventory" },
  { value: "crm",               label: "CRM" },
  { value: "erp",               label: "ERP" },
  { value: "other",             label: "Other" },
] as const;

export const PROJECT_STATUS_OPTIONS = [
  { value: "lead",        label: "Lead" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "on_hold",     label: "On Hold" },
  { value: "cancelled",   label: "Cancelled" },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid",    label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export const PAYMENT_TERM_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid",    label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export const PAYMENT_MODE_OPTIONS = [
  { value: "cash",          label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi",           label: "UPI" },
  { value: "cheque",        label: "Cheque" },
  { value: "online",        label: "Online" },
] as const;

export const DEPLOYMENT_PLATFORM_OPTIONS = [
  { value: "vercel",        label: "Vercel" },
  { value: "netlify",       label: "Netlify" },
  { value: "aws",           label: "AWS" },
  { value: "digital_ocean", label: "Digital Ocean" },
  { value: "hostinger",     label: "Hostinger" },
  { value: "cpanel",        label: "cPanel" },
  { value: "vps",           label: "VPS" },
  { value: "heroku",        label: "Heroku" },
  { value: "render",        label: "Render" },
  { value: "firebase",      label: "Firebase" },
  { value: "other",         label: "Other" },
  { value: "na",            label: "N/A" },
] as const;

// ── Derived types ──────────────────────────────────────────────────────────────

export type ProjectType       = typeof PROJECT_TYPE_OPTIONS[number]["value"];
export type ProjectStatus     = typeof PROJECT_STATUS_OPTIONS[number]["value"];
export type PaymentStatus     = typeof PAYMENT_STATUS_OPTIONS[number]["value"];
export type PaymentTermStatus = typeof PAYMENT_TERM_STATUS_OPTIONS[number]["value"];
export type PaymentMode       = typeof PAYMENT_MODE_OPTIONS[number]["value"];
export type DeploymentPlatform = typeof DEPLOYMENT_PLATFORM_OPTIONS[number]["value"];

// ── Data models ────────────────────────────────────────────────────────────────

export interface PaymentTerm {
  term_number:   number;
  amount:        number;
  due_date?:     string | null;
  paid_date?:    string | null;
  payment_mode?: PaymentMode | null;
  status:        PaymentTermStatus;
  note?:         string | null;
}

export interface MaintenanceTerm {
  term_number:   number;
  amount:        number;
  start_date?:   string | null;
  end_date?:     string | null;
  due_date?:     string | null;
  paid_date?:    string | null;
  payment_mode?: PaymentMode | null;
  status:        PaymentTermStatus;
  note?:         string | null;
}

export interface Project {
  _id:                         string;
  reference_id:                string;
  client_name:                 string;
  client_mobile:               string;
  client_alternative_mobile?:  string | null;
  client_email?:               string | null;
  project_name:                string;
  project_type:                ProjectType;
  project_description?:        string | null;
  project_status:              ProjectStatus;
  is_lead_converted:           boolean;
  lead_converted_date?:        string | null;
  project_github_link?:        string | null;
  frontend_deploy_on?:         DeploymentPlatform | null;
  frontend_deploy_url?:        string | null;
  backend_deploy_on?:          DeploymentPlatform | null;
  backend_deploy_url?:         string | null;
  is_maintenance_mode:         boolean;
  maintenance_start_date?:     string | null;
  maintenance_end_date?:       string | null;
  payment_status:              PaymentStatus;
  payment_total_amount:        number;
  payment_paid_amount:         number;
  payment_due_amount:          number;
  payment_terms:               PaymentTerm[];
  maintenance_total_amount?:   number | null;
  maintenance_paid_amount?:    number | null;
  maintenance_due_amount?:     number | null;
  maintenance_payment_status?: PaymentStatus | null;
  maintenance_terms?:          MaintenanceTerm[];
  created_by:                  string;
  is_active:                   boolean;
  createdAt:                   string;
  updatedAt:                   string;
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface ProjectListResponse {
  success: boolean;
  message: string;
  data: {
    data:        Project[];
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
  };
}

export interface ProjectSingleResponse {
  success: boolean;
  message: string;
  data:    Project;
}

// ── Form payloads ──────────────────────────────────────────────────────────────

export interface CreateProjectPayload {
  client_name:                string;
  client_mobile:              string;
  client_alternative_mobile?: string;
  client_email?:              string;
  project_name:               string;
  project_type:               ProjectType;
  project_description?:       string;
  project_status?:            ProjectStatus;
  is_lead_converted?:         boolean;
  lead_converted_date?:       string | null;
  project_github_link?:       string;
  frontend_deploy_on?:        DeploymentPlatform;
  frontend_deploy_url?:       string;
  backend_deploy_on?:         DeploymentPlatform;
  backend_deploy_url?:        string;
  is_maintenance_mode?:       boolean;
  maintenance_start_date?:    string | null;
  maintenance_end_date?:      string | null;
  payment_total_amount:        number;
  payment_terms?:              PaymentTermInput[];
  maintenance_total_amount?:   number;
  maintenance_terms?:          MaintenanceTermInput[];
}

export interface PaymentTermInput {
  term_number: number;
  amount:      number;
  due_date?:   string;
  note?:       string;
}

export interface MaintenanceTermInput {
  term_number:   number;
  amount:        number;
  start_date?:   string;
  end_date?:     string;
  due_date?:     string;
  paid_date?:    string;
  payment_mode?: PaymentMode;
  status?:       PaymentTermStatus;
  note?:         string;
}

export interface AddTermPayload {
  term_number:    number;
  amount:         number;
  due_date?:      string;
  payment_mode?:  PaymentMode;
  note?:          string;
}

export interface MarkPaidPayload {
  paid_date?:     string;
  payment_mode?:  PaymentMode;
}

// ── List filter state ──────────────────────────────────────────────────────────

export interface ProjectFilters {
  search:          string;
  project_status:  string;
  project_type:    string;
  payment_status:  string;
  date_from:       string;
  date_to:         string;
}

export const EMPTY_FILTERS: ProjectFilters = {
  search:         "",
  project_status: "",
  project_type:   "",
  payment_status: "",
  date_from:      "",
  date_to:        "",
};

// ── Badge style maps ───────────────────────────────────────────────────────────

import type React from "react";

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, React.CSSProperties> = {
  lead:        { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)" },
  in_progress: { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)" },
  completed:   { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)" },
  on_hold:     { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)" },
  cancelled:   { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)" },
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  lead:        "Lead",
  in_progress: "In Progress",
  completed:   "Completed",
  on_hold:     "On Hold",
  cancelled:   "Cancelled",
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, React.CSSProperties> = {
  pending: { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)" },
  partial: { background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" },
  paid:    { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)" },
  overdue: { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)" },
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  paid:    "Paid",
  overdue: "Overdue",
};

export const PAYMENT_TERM_STATUS_STYLE: Record<PaymentTermStatus, React.CSSProperties> = {
  pending: { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)" },
  paid:    { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)" },
  overdue: { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "₹0";
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Convert YYYY-MM-DD date string to ISO 8601 (UTC midnight) */
export function toISO(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  return `${dateStr}T00:00:00.000Z`;
}

/** Convert ISO string to YYYY-MM-DD for date input */
export function fromISO(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  return isoStr.slice(0, 10);
}

export function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  return options.find((o) => o.value === value)?.label ?? value ?? "—";
}
