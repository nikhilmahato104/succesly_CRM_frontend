import React, { useCallback, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CalendarRange, ListFilter, X, ChevronDown } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessToken } from "../../store/slices/authSlice";
import type { RootState } from "../../store";
import {
  CleanButton,
  CleanSearchBar,
  CleanInput,
  CleanSelect,
  type SelectOption,
} from "../../atoms/my_clean_code_atoms";
import {
  fetchActivityLogs,
  type ActivityLogItem,
  type ActivityLogListResponse,
} from "../../services/activityLogApi";
import ActivityLogDetail from "./ActivityLogDetail";

// ── Static maps ───────────────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
};

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  create:    { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  update:    { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  delete:    { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
  view:      { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  list:      { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  mark_paid: { background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
  add_term:  { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
};

const MODULE_STYLE: Record<string, React.CSSProperties> = {
  project: { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  booking: { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
  user:    { background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
};

const METHOD_STYLE: Record<string, React.CSSProperties> = {
  GET:    { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  POST:   { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  PATCH:  { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
  PUT:    { background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" },
  DELETE: { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
};

function statusCodeStyle(code: number): React.CSSProperties {
  if (code >= 500) return { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"   };
  if (code >= 400) return { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)" };
  return                   { background: "var(--badge-green-bg)", color: "var(--badge-green-text)" };
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Options ───────────────────────────────────────────────────────────────────

const ACTION_OPTIONS: SelectOption[] = [
  { value: "create",    label: "Create"    },
  { value: "update",    label: "Update"    },
  { value: "delete",    label: "Delete"    },
  { value: "view",      label: "View"      },
  { value: "list",      label: "List"      },
  { value: "mark_paid", label: "Mark Paid" },
  { value: "add_term",  label: "Add Term"  },
];

const MODULE_OPTIONS: SelectOption[] = [
  { value: "project", label: "Project" },
  { value: "booking", label: "Booking" },
  { value: "user",    label: "User"    },
];

const METHOD_OPTIONS: SelectOption[] = [
  { value: "GET",    label: "GET"    },
  { value: "POST",   label: "POST"   },
  { value: "PATCH",  label: "PATCH"  },
  { value: "PUT",    label: "PUT"    },
  { value: "DELETE", label: "DELETE" },
];

const SUCCESS_OPTIONS: SelectOption[] = [
  { value: "true",  label: "Success only"  },
  { value: "false", label: "Failed only"   },
];

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: GridColumn<ActivityLogItem>[] = [
  {
    field: "createdAt",
    headerName: "When",
    minWidth: 155,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 11, color: "var(--dt-muted)", whiteSpace: "nowrap" }}>
        {row.createdAt ? formatShortDate(row.createdAt) : "—"}
      </span>
    ),
  },
  {
    field: "user_email",
    headerName: "User",
    minWidth: 180,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 11, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.user_email || "—"}
      </span>
    ),
  },
  {
    field: "action",
    headerName: "Action",
    minWidth: 100,
    renderCell: ({ row }) => (
      <span style={{ ...pillStyle, ...(ACTION_STYLE[row.action] ?? { background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" }), textTransform: "capitalize" }}>
        {row.action}
      </span>
    ),
  },
  {
    field: "module",
    headerName: "Module",
    minWidth: 100,
    renderCell: ({ row }) => (
      <span style={{ ...pillStyle, ...(MODULE_STYLE[row.module] ?? { background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" }), textTransform: "capitalize" }}>
        {row.module}
      </span>
    ),
  },
  {
    field: "entity_ref",
    headerName: "Entity",
    minWidth: 200,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 11, color: "var(--dt-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.entity_ref || "—"}
      </span>
    ),
  },
  {
    field: "description",
    headerName: "Description",
    minWidth: 260,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 260 }}>
        {row.description || "—"}
      </span>
    ),
  },
  {
    field: "status_code",
    headerName: "Status",
    minWidth: 80,
    renderCell: ({ row }) => (
      <span style={{ ...pillStyle, ...statusCodeStyle(row.status_code) }}>
        {row.status_code}
      </span>
    ),
  },
  {
    field: "method",
    headerName: "Method",
    minWidth: 80,
    renderCell: ({ row }) => (
      <span style={{ ...pillStyle, ...(METHOD_STYLE[row.method] ?? { background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" }) }}>
        {row.method}
      </span>
    ),
  },
  {
    field: "response_time_ms",
    headerName: "Time (ms)",
    minWidth: 90,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 11, color: "var(--dt-muted)", fontFamily: "ui-monospace, monospace" }}>
        {row.response_time_ms != null ? `${row.response_time_ms}ms` : "—"}
      </span>
    ),
  },
];

// ── Filter types ──────────────────────────────────────────────────────────────

interface Filters {
  search:     string;
  module:     string;
  action:     string;
  method:     string;
  is_success: string;
  user_email: string;
  date_from:  string;
  date_to:    string;
}

const EMPTY: Filters = {
  search: "", module: "", action: "", method: "",
  is_success: "", user_email: "", date_from: "", date_to: "",
};

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

// ── Component ─────────────────────────────────────────────────────────────────

const ActivityLogs: React.FC = () => {
  const token   = useSelector(selectAccessToken);
  const dispatch = useDispatch();
  const apiKey   = useSelector((s: RootState) => selectApiKey(s));

  const [data,        setData]        = React.useState<ActivityLogItem[]>([]);
  const [filters,     setFilters]     = React.useState<Filters>(EMPTY);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [total,       setTotal]       = React.useState(0);
  const [loading,     setLoading]     = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore,     setHasMore]     = React.useState(false);
  const [detailLog,   setDetailLog]   = React.useState<ActivityLogItem | null>(null);

  const [showDatePanel,   setShowDatePanel]   = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const datePanelRef   = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef       = useRef(1);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const PER_PAGE = 25;

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePanelRef.current   && !datePanelRef.current.contains(e.target as Node))   setShowDatePanel(false);
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof Filters>(key: K, val: string) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(EMPTY);

  const activeFilterCount = [
    filters.module, filters.action, filters.method,
    filters.is_success, filters.user_email, filters.date_from, filters.date_to,
  ].filter(Boolean).length;

  const hasDates  = !!(filters.date_from || filters.date_to);
  const dateLabel = hasDates ? `${filters.date_from || "…"} – ${filters.date_to || "…"}` : "Date range";

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit:      PER_PAGE,
      search:     debouncedSearch         || undefined,
      module:     filters.module          || undefined,
      action:     filters.action          || undefined,
      method:     filters.method          || undefined,
      is_success: filters.is_success !== "" ? filters.is_success : undefined,
      user_email: filters.user_email      || undefined,
      date_from:  filters.date_from       || undefined,
      date_to:    filters.date_to         || undefined,
    }),
    [debouncedSearch, filters],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }

      let signal: AbortSignal | undefined;
      if (!append) {
        fetchAbortRef.current?.abort();
        fetchAbortRef.current = new AbortController();
        signal = fetchAbortRef.current.signal;
      }

      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await fetchActivityLogs(buildParams(page), signal);
        const items = res.data.data;
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch (err: unknown) {
        const name = (err as any)?.name ?? (err as any)?.code;
        if (name === "AbortError" || name === "CanceledError" || (err as any)?.message === "canceled") return;
        showToastnew.error("Failed to fetch activity logs");
      } finally {
        if (!signal?.aborted) {
          append ? setLoadingMore(false) : setLoading(false);
          if (!append) requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
        }
      }
    },
    [apiKey, token, buildParams, dispatch],
  );

  useEffect(() => {
    pageRef.current = 1;
    setData([]);
    fetchPage(1, false);
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);
  const handleView     = useCallback((row: ActivityLogItem) => setDetailLog(row), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderBottom: "1px solid var(--fi-border)",
        flexShrink: 0, flexWrap: "wrap", background: "var(--fi-bg)",
      }}>

        {/* Search */}
        <CleanSearchBar
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
          placeholder="Search description, user, entity…"
          width={240}
        />

        {/* Date range */}
        <div style={{ position: "relative" }} ref={datePanelRef}>
          <CleanButton
            variant="outline" size="sm"
            iconLeft={<CalendarRange style={{ width: 13, height: 13 }} />}
            iconRight={hasDates ? undefined : <ChevronDown style={{ width: 11, height: 11 }} />}
            onClick={() => setShowDatePanel((v) => !v)}
            style={hasDates ? { borderColor: "var(--fi-border-focus)" } : undefined}
          >
            {hasDates ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {dateLabel}
                <span onClick={(e) => { e.stopPropagation(); setFilter("date_from", ""); setFilter("date_to", ""); }}
                  style={{ display: "flex", cursor: "pointer", color: "var(--fi-muted)" }}>
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
            variant="outline" size="sm"
            iconLeft={<ListFilter style={{ width: 13, height: 13 }} />}
            badge={activeFilterCount > 0 ? activeFilterCount : undefined}
            onClick={() => setShowFilterPanel((v) => !v)}
            style={activeFilterCount > 0 ? { borderColor: "var(--fi-border-focus)" } : undefined}
          >
            Filter
          </CleanButton>

          {showFilterPanel && (
            <div style={{ ...panelStyle, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fi-muted)" }}>
                Filters
              </span>
              <CleanSelect label="Module"     value={filters.module}     onChange={(e) => setFilter("module",     e.target.value)} options={MODULE_OPTIONS}  placeholder="All modules"  />
              <CleanSelect label="Action"     value={filters.action}     onChange={(e) => setFilter("action",     e.target.value)} options={ACTION_OPTIONS}  placeholder="All actions"  />
              <CleanSelect label="Method"     value={filters.method}     onChange={(e) => setFilter("method",     e.target.value)} options={METHOD_OPTIONS}  placeholder="All methods"  />
              <CleanSelect label="Result"     value={filters.is_success} onChange={(e) => setFilter("is_success", e.target.value)} options={SUCCESS_OPTIONS} placeholder="All results"  />
              <CleanInput  label="User email" value={filters.user_email} onChange={(e) => setFilter("user_email", e.target.value)} placeholder="nikhil@…" type="text" />
              {activeFilterCount > 0 && (
                <CleanButton variant="danger" size="xs" onClick={clearAllFilters} style={{ width: "100%" }}>
                  Clear all filters
                </CleanButton>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Total count */}
        <span style={{ fontSize: 11, color: "var(--fi-muted)", whiteSpace: "nowrap" }}>
          {total.toLocaleString()} log{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<ActivityLogItem>
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
          emptyStateTitle="No activity logs found"
          emptyStateSubtitle="Try adjusting your search or filters"
          onView={handleView}
        />
      </div>

      {/* ── Detail panel ───────────────────────────────────────────────────────── */}
      {detailLog && (
        <ActivityLogDetail log={detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  );
};

export default ActivityLogs;
