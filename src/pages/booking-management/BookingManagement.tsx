import React, { useCallback, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectAccessToken } from "../../store/slices/authSlice";
import {
  CalendarRange,
  ListFilter,
  Upload,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, deleteData } from "../../services/crmServices";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import CreateBookingModal from "./CreateBookingModal";
import {
  CleanButton,
  CleanSearchBar,
  CleanInput,
  CleanSelect,
  type SelectOption,
} from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────────

type BookingStatus =
  | "ongoing"
  | "completed"
  | "cancelled_via_user"
  | "cancelled_by_admin_crm";
type BookingVia = "app" | "website" | "laptop" | "whatsapp_to_crm" | "call";

interface BookingApiItem {
  _id: string;
  reference_id: string;
  branch?: string;
  user_name?: string;
  user_phone?: string;
  address?: string;
  booking_via: BookingVia;
  booking_status: BookingStatus;
  is_active: boolean;
  createdAt?: string;
}

interface BookingsApiResponse {
  success: boolean;
  message: string;
  data: {
    data: BookingApiItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Static maps ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<BookingStatus, React.CSSProperties> = {
  ongoing:              { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)" },
  completed:            { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)" },
  cancelled_via_user:   { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"   },
  cancelled_by_admin_crm: { background: "var(--badge-red-bg)", color: "var(--badge-red-text)"   },
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  ongoing:              "Ongoing",
  completed:            "Completed",
  cancelled_via_user:   "Cancelled (User)",
  cancelled_by_admin_crm: "Cancelled (Admin)",
};

const VIA_STYLE: Record<BookingVia, React.CSSProperties> = {
  app:            { background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
  website:        { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  laptop:         { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  whatsapp_to_crm:{ background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  call:           { background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" },
};

const VIA_LABEL: Record<BookingVia, string> = {
  app: "App", website: "Website", laptop: "Laptop",
  whatsapp_to_crm: "WhatsApp", call: "Call",
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ongoing",              label: "Ongoing" },
  { value: "completed",            label: "Completed" },
  { value: "cancelled_via_user",   label: "Cancelled (User)" },
  { value: "cancelled_by_admin_crm", label: "Cancelled (Admin)" },
];
const VIA_OPTIONS: SelectOption[] = [
  { value: "app",             label: "App" },
  { value: "website",         label: "Website" },
  { value: "laptop",          label: "Laptop" },
  { value: "whatsapp_to_crm", label: "WhatsApp" },
  { value: "call",            label: "Call" },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Inline badge helpers ───────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500,
};

const StatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => (
  <span style={{ ...pillStyle, ...STATUS_STYLE[status] }}>{STATUS_LABEL[status] ?? status}</span>
);

const ViaBadge: React.FC<{ via: BookingVia }> = ({ via }) => (
  <span style={{ ...pillStyle, ...VIA_STYLE[via] }}>{VIA_LABEL[via] ?? via}</span>
);

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: GridColumn<BookingApiItem>[] = [
  {
    field: "reference_id",
    headerName: "Reference ID",
    minWidth: 155,
    renderCell: ({ row }) => (
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, background: "var(--dt-header)", color: "var(--dt-text)", padding: "2px 7px", borderRadius: 5 }}>
        {row.reference_id}
      </span>
    ),
  },
  {
    field: "user_name",
    headerName: "Customer",
    minWidth: 180,
    sortable: true,
    renderCell: ({ row }) => (
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.user_name || "—"}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.user_phone || ""}
        </p>
      </div>
    ),
  },
  {
    field: "address",
    headerName: "Address",
    minWidth: 200,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.address || "—"}
      </span>
    ),
  },
  {
    field: "branch",
    headerName: "Branch",
    minWidth: 130,
    sortable: true,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-dim)" }}>{row.branch || "—"}</span>
    ),
  },
  {
    field: "booking_via",
    headerName: "Via",
    minWidth: 110,
    renderCell: ({ row }) => <ViaBadge via={row.booking_via} />,
  },
  {
    field: "booking_status",
    headerName: "Status",
    minWidth: 160,
    renderCell: ({ row }) => <StatusBadge status={row.booking_status} />,
  },
  {
    field: "createdAt",
    headerName: "Created",
    minWidth: 120,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>
        {row.createdAt ? formatShortDate(row.createdAt) : "—"}
      </span>
    ),
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  booking_status: string;
  booking_via: string;
  branch: string;
  date_from: string;
  date_to: string;
}

const EMPTY: Filters = {
  search: "", booking_status: "", booking_via: "",
  branch: "", date_from: "", date_to: "",
};

// ── Panel overlay style (shared) ───────────────────────────────────────────────

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

const BookingManagement: React.FC = () => {
  const token = useSelector(selectAccessToken);
  const dispatch = useDispatch();
  const apiKey = useSelector((s: RootState) => selectApiKey(s));
  const access = useSelector((s: RootState) => selectAccessData(s));
  const perms = (access?.["booking_management"] ?? {}) as Record<string, boolean>;

  const [data, setData] = React.useState<BookingApiItem[]>([]);
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const [showDatePanel, setShowDatePanel] = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const datePanelRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef = useRef(1);
  const PER_PAGE = 25;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target as Node))
        setShowDatePanel(false);
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node))
        setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof Filters>(key: K, val: string) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(EMPTY);

  const activeFilterCount = [
    filters.booking_status, filters.booking_via,
    filters.branch, filters.date_from, filters.date_to,
  ].filter(Boolean).length;

  const hasDates = !!(filters.date_from || filters.date_to);
  const dateLabel = hasDates
    ? `${filters.date_from || "…"} – ${filters.date_to || "…"}`
    : "Date range";

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit: PER_PAGE,
      search:         debouncedSearch || undefined,
      booking_status: filters.booking_status || undefined,
      booking_via:    filters.booking_via || undefined,
      branch:         filters.branch || undefined,
      date_from:      filters.date_from || undefined,
      date_to:        filters.date_to || undefined,
    }),
    [debouncedSearch, filters],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await getData<BookingsApiResponse>({
          endpoint: "bookings",
          token: token,
          instance: "identity",
          params: buildParams(page),
        });
        const items = res.data.data;
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch {
        showToastnew.error("Failed to fetch bookings");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
        if (!append) requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
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

  // ── Row action handlers ───────────────────────────────────────────────────
  const handleView = useCallback((row: BookingApiItem) => {
    showToastnew.info(`View: ${row.reference_id}`);
  }, []);

  const handleEdit = useCallback((row: BookingApiItem) => {
    // TODO: call getById, then prefill the edit modal when it exists
    showToastnew.info(`Edit: ${row.reference_id} — edit modal coming soon`);
  }, []);

  const handleDelete = useCallback(async (row: BookingApiItem) => {
    await deleteData({ endpoint: `bookings/${row._id}`, token: token, instance: "identity" });
    showToastnew.success("Booking deleted");
    handleRefresh();
  }, [token, handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(
      ids.map((id) => deleteData({ endpoint: `bookings/${id}`, token: token, instance: "identity" }))
    );
    showToastnew.success(`${ids.length} booking${ids.length > 1 ? "s" : ""} deleted`);
    handleRefresh();
  }, [token, handleRefresh]);

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

        {/* Search */}
        <CleanSearchBar
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
          placeholder="Search reference, name, phone…"
          width={230}
        />

        {/* Date range */}
        <div style={{ position: "relative" }} ref={datePanelRef}>
          <CleanButton
            variant="outline"
            size="sm"
            iconLeft={<CalendarRange style={{ width: 13, height: 13 }} />}
            iconRight={hasDates
              ? undefined
              : <ChevronDown style={{ width: 11, height: 11 }} />}
            onClick={() => setShowDatePanel((v) => !v)}
            style={hasDates ? { borderColor: "var(--fi-border-focus)" } : undefined}
          >
            {hasDates ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {dateLabel}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("date_from", "");
                    setFilter("date_to", "");
                  }}
                  style={{ display: "flex", cursor: "pointer", color: "var(--fi-muted)" }}
                >
                  <X style={{ width: 11, height: 11 }} />
                </span>
              </span>
            ) : dateLabel}
          </CleanButton>

          {showDatePanel && (
            <div style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <CleanInput
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilter("date_from", e.target.value)}
                style={{ width: 148 }}
              />
              <span style={{ fontSize: 12, color: "var(--fi-muted)" }}>–</span>
              <CleanInput
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilter("date_to", e.target.value)}
                style={{ width: 148 }}
              />
              <CleanButton variant="primary" size="sm" onClick={() => setShowDatePanel(false)}>Done</CleanButton>
            </div>
          )}
        </div>

        {/* Filter */}
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
                label="Status"
                value={filters.booking_status}
                onChange={(e) => setFilter("booking_status", e.target.value)}
                options={STATUS_OPTIONS}
                placeholder="All statuses"
              />

              <CleanSelect
                label="Source"
                value={filters.booking_via}
                onChange={(e) => setFilter("booking_via", e.target.value)}
                options={VIA_OPTIONS}
                placeholder="All sources"
              />

              <CleanInput
                label="Branch"
                type="text"
                value={filters.branch}
                onChange={(e) => setFilter("branch", e.target.value)}
                placeholder="Branch name…"
              />

              {activeFilterCount > 0 && (
                <CleanButton variant="danger" size="xs" onClick={clearAllFilters} style={{ width: "100%" }}>
                  Clear all filters
                </CleanButton>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <CleanButton
          variant="outline"
          size="sm"
          iconLeft={<Upload style={{ width: 13, height: 13 }} />}
          title="Export bookings"
        >
          Export
        </CleanButton>

        <div style={{ flex: 1 }} />

        {/* Create */}
        {perms.create !== false && (
          <CleanButton
            variant="primary"
            size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => setShowModal(true)}
          >
            Create Booking
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<BookingApiItem>
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
          // ── Selection + bulk delete ──────────────────────────────────────
          selectable={perms.delete !== false}
          onBulkDelete={perms.delete !== false ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected bookings — this cannot be undone"
          // ── Row actions ──────────────────────────────────────────────────
          onView={handleView}
          onEdit={perms.update !== false ? handleEdit : undefined}
          onDelete={perms.delete !== false ? handleDelete : undefined}
          deleteConfirmTitle="Delete booking?"
          deleteConfirmDescription="This will permanently remove the booking record. This action cannot be undone."
        />
      </div>

      {showModal && (
        <CreateBookingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); handleRefresh(); }}
        />
      )}
    </div>
  );
};

export default BookingManagement;
