import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Plus, CalendarRange, ListFilter, X, ChevronDown } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import {
  CleanButton,
  CleanSearchBar,
  CleanInput,
  CleanSelect,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectAccessData } from "../../store/slices/accessSlice";
import { openApiKeyModal, selectApiKey } from "../../store/slices/apiKeySlice";
import type { RootState } from "../../store";
import { fetchProjects, deleteProject } from "../../services/projectApi";
import {
  type Project,
  type ProjectFilters,
  EMPTY_FILTERS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PROJECT_STATUS_STYLE,
  PROJECT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  formatCurrency,
  labelFor,
} from "./types";

// ── Badge helpers ──────────────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500,
};

const ProjectStatusBadge: React.FC<{ status: Project["project_status"] }> = ({ status }) => (
  <span style={{ ...pillStyle, ...PROJECT_STATUS_STYLE[status] }}>
    {PROJECT_STATUS_LABEL[status] ?? status}
  </span>
);

const PaymentStatusBadge: React.FC<{ status: Project["payment_status"] }> = ({ status }) => (
  <span style={{ ...pillStyle, ...PAYMENT_STATUS_STYLE[status] }}>
    {PAYMENT_STATUS_LABEL[status] ?? status}
  </span>
);

// ── Column definitions ─────────────────────────────────────────────────────────

const COLUMNS: GridColumn<Project>[] = [
  {
    field: "reference_id",
    headerName: "Reference ID",
    minWidth: 170,
    renderCell: ({ row }) => (
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, background: "var(--dt-header)", color: "var(--dt-text)", padding: "2px 7px", borderRadius: 5 }}>
        {row.reference_id}
      </span>
    ),
  },
  {
    field: "client_name",
    headerName: "Client",
    minWidth: 180,
    sortable: true,
    renderCell: ({ row }) => (
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.client_name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.client_mobile}
        </p>
      </div>
    ),
  },
  {
    field: "project_name",
    headerName: "Project",
    minWidth: 180,
    sortable: true,
    renderCell: ({ row }) => (
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.project_name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", textTransform: "capitalize" }}>
          {labelFor(PROJECT_TYPE_OPTIONS, row.project_type)}
        </p>
      </div>
    ),
  },
  {
    field: "project_status",
    headerName: "Status",
    minWidth: 130,
    renderCell: ({ row }) => <ProjectStatusBadge status={row.project_status} />,
  },
  {
    field: "payment_status",
    headerName: "Payment",
    minWidth: 110,
    renderCell: ({ row }) => <PaymentStatusBadge status={row.payment_status} />,
  },
  {
    field: "payment_total_amount",
    headerName: "Total",
    minWidth: 110,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-text)", fontWeight: 500 }}>
        {formatCurrency(row.payment_total_amount)}
      </span>
    ),
  },
  {
    field: "payment_due_amount",
    headerName: "Due",
    minWidth: 110,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: row.payment_due_amount > 0 ? "#ef4444" : "var(--dt-muted)" }}>
        {formatCurrency(row.payment_due_amount)}
      </span>
    ),
  },
  {
    field: "is_maintenance_mode",
    headerName: "Maintenance",
    minWidth: 120,
    renderCell: ({ row }) =>
      row.is_maintenance_mode ? (
        <span style={{ ...pillStyle, background: "var(--badge-amber-bg)", color: "var(--badge-amber-text)", gap: 4 }}>
          🔧 Active
        </span>
      ) : (
        <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>—</span>
      ),
  },
];

// ── Panel overlay style ────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position:     "absolute",
  top:          "calc(100% + 4px)",
  left:         0,
  zIndex:       50,
  background:   "var(--fi-bg-panel)",
  border:       "1px solid var(--fi-border)",
  borderRadius: "var(--fi-radius)",
  boxShadow:    "0 4px 20px rgba(0,0,0,0.10)",
  padding:      12,
};

// ── Component ──────────────────────────────────────────────────────────────────

const ProjectManagement: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const apiKey = useSelector((s: RootState) => selectApiKey(s));
  const access = useSelector((s: RootState) => selectAccessData(s));
  const perms  = (access?.["project_management"] ?? {}) as Record<string, boolean>;

  const [data,        setData]        = useState<Project[]>([]);
  const [filters,     setFilters]     = useState<ProjectFilters>(EMPTY_FILTERS);
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);

  const [showDatePanel,   setShowDatePanel]   = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const datePanelRef   = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef      = useRef(1);
  const abortRef     = useRef<AbortController | null>(null);
  const PER_PAGE     = 25;

  // close panels on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target as Node))
        setShowDatePanel(false);
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node))
        setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.search.trim()), 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof ProjectFilters>(key: K, val: string) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(EMPTY_FILTERS);

  const activeFilterCount = [
    filters.project_status, filters.project_type,
    filters.payment_status, filters.date_from, filters.date_to,
  ].filter(Boolean).length;

  const hasDates  = !!(filters.date_from || filters.date_to);
  const dateLabel = hasDates
    ? `${filters.date_from || "…"} – ${filters.date_to || "…"}`
    : "Date range";

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit:          PER_PAGE,
      search:         debouncedQ || undefined,
      project_status: filters.project_status || undefined,
      project_type:   filters.project_type   || undefined,
      payment_status: filters.payment_status || undefined,
      date_from:      filters.date_from      || undefined,
      date_to:        filters.date_to        || undefined,
    }),
    [debouncedQ, filters],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }

      let signal: AbortSignal | undefined;
      if (!append) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        signal = abortRef.current.signal;
      }

      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await fetchProjects({ ...buildParams(page) });
        const items = res.data.data;
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch (err: unknown) {
        const name = (err as any)?.name ?? (err as any)?.code;
        if (name === "AbortError" || name === "CanceledError" || (err as any)?.message === "canceled") return;
        showToastnew.error("Failed to fetch projects");
      } finally {
        if (!signal?.aborted) {
          append ? setLoadingMore(false) : setLoading(false);
          if (!append) requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
        }
      }
    },
    [apiKey, buildParams, dispatch],
  );

  useEffect(() => {
    pageRef.current = 1;
    setData([]);
    fetchPage(1, false);
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleView   = useCallback((row: Project) => navigate(`/projects/${row._id}`), [navigate]);
  const handleEdit   = useCallback((row: Project) => navigate(`/projects/${row._id}/edit`), [navigate]);
  const handleDelete = useCallback(async (row: Project) => {
    try {
      await deleteProject(row._id);
      showToastnew.success("Project deleted");
      handleRefresh();
    } catch {
      showToastnew.error("Failed to delete project");
    }
  }, [handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    try {
      await Promise.all(ids.map((id) => deleteProject(String(id))));
      showToastnew.success(`${ids.length} project${ids.length > 1 ? "s" : ""} deleted`);
      handleRefresh();
    } catch {
      showToastnew.error("Failed to delete selected projects");
    }
  }, [handleRefresh]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        padding:      "7px 12px",
        borderBottom: "1px solid var(--fi-border)",
        flexShrink:   0,
        flexWrap:     "wrap",
        background:   "var(--fi-bg)",
      }}>

        <CleanSearchBar
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
          placeholder="Search name, mobile, email, project…"
          width={240}
        />

        {/* Date range panel */}
        <div style={{ position: "relative" }} ref={datePanelRef}>
          <CleanButton
            variant="outline"
            size="sm"
            iconLeft={<CalendarRange style={{ width: 13, height: 13 }} />}
            iconRight={hasDates ? undefined : <ChevronDown style={{ width: 11, height: 11 }} />}
            onClick={() => setShowDatePanel((v) => !v)}
            style={hasDates ? { borderColor: "var(--fi-border-focus)" } : undefined}
          >
            {hasDates ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {dateLabel}
                <span onClick={(e) => { e.stopPropagation(); setFilter("date_from", ""); setFilter("date_to", ""); }} style={{ display: "flex", cursor: "pointer", color: "var(--fi-muted)" }}>
                  <X style={{ width: 11, height: 11 }} />
                </span>
              </span>
            ) : dateLabel}
          </CleanButton>

          {showDatePanel && (
            <div style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <CleanInput type="date" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} style={{ width: 148 }} />
              <span style={{ fontSize: 12, color: "var(--fi-muted)" }}>–</span>
              <CleanInput type="date" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} style={{ width: 148 }} />
              <CleanButton variant="primary" size="sm" onClick={() => setShowDatePanel(false)}>Done</CleanButton>
            </div>
          )}
        </div>

        {/* Filter panel */}
        <div style={{ position: "relative" }} ref={filterPanelRef}>
          <CleanButton
            variant="outline"
            size="sm"
            iconLeft={<ListFilter style={{ width: 13, height: 13 }} />}
            badge={activeFilterCount > 0 ? activeFilterCount : undefined}
            onClick={() => setShowFilterPanel((v) => !v)}
            style={activeFilterCount > 0 ? { borderColor: "var(--fi-border-focus)" } : undefined}
          >
            Filter
          </CleanButton>

          {showFilterPanel && (
            <div style={{ ...panelStyle, minWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fi-muted)" }}>
                Filters
              </span>

              <CleanSelect
                label="Project Status"
                value={filters.project_status}
                onChange={(e) => setFilter("project_status", e.target.value)}
                options={PROJECT_STATUS_OPTIONS as unknown as { value: string; label: string }[]}
                placeholder="All statuses"
              />

              <CleanSelect
                label="Project Type"
                value={filters.project_type}
                onChange={(e) => setFilter("project_type", e.target.value)}
                options={PROJECT_TYPE_OPTIONS as unknown as { value: string; label: string }[]}
                placeholder="All types"
              />

              <CleanSelect
                label="Payment Status"
                value={filters.payment_status}
                onChange={(e) => setFilter("payment_status", e.target.value)}
                options={PAYMENT_STATUS_OPTIONS as unknown as { value: string; label: string }[]}
                placeholder="All payments"
              />

              {activeFilterCount > 0 && (
                <CleanButton variant="danger" size="xs" onClick={clearAllFilters} style={{ width: "100%" }}>
                  Clear all filters
                </CleanButton>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {perms.create !== false && (
          <CleanButton
            variant="primary"
            size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => navigate("/projects/new")}
          >
            New Project
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<Project>
          rows={data}
          columns={COLUMNS}
          getRowId={(row) => row._id}
          isLoading={loading}
          totalItems={total}
          onScrollPagination
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onRefresh={handleRefresh}
          emptyStateImage="/icons/no-booking-found.png"
          emptyStateTitle="No projects found"
          emptyStateSubtitle="Try adjusting your search or filters, or create a new project"
          selectable={perms.delete !== false}
          onBulkDelete={perms.delete !== false ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected projects — this cannot be undone"
          onView={handleView}
          onEdit={perms.update !== false ? handleEdit : undefined}
          onDelete={perms.delete !== false ? handleDelete : undefined}
          deleteConfirmTitle="Delete project?"
          deleteConfirmDescription="This will permanently remove the project and all associated payment data. This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default ProjectManagement;
