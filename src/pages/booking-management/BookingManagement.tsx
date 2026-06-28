import React, { useCallback, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectAccessToken } from "../../store/slices/authSlice";
import { SlidersHorizontal, Plus } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, deleteData } from "../../services/crmServices";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import CreateBookingModal, { type InitialBookingData } from "./CreateBookingModal";
import { OPEN_CREATE_BOOKING_EVENT } from "../../organisms/MobileBottomBar";
import {
  CleanButton,
  CleanSearchBar,
  CleanModal,
  CleanDropdown,
  CleanDateRangePicker,
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
  ongoing:               { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
  completed:             { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  cancelled_via_user:    { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
  cancelled_by_admin_crm:{ background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  ongoing:               "Ongoing",
  completed:             "Completed",
  cancelled_via_user:    "Cancelled (User)",
  cancelled_by_admin_crm:"Cancelled (Admin)",
};

const VIA_STYLE: Record<BookingVia, React.CSSProperties> = {
  app:             { background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
  website:         { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  laptop:          { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  whatsapp_to_crm: { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  call:            { background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" },
};

const VIA_LABEL: Record<BookingVia, string> = {
  app: "App", website: "Website", laptop: "Laptop",
  whatsapp_to_crm: "WhatsApp", call: "Call",
};

const STATUS_OPTIONS = [
  { value: "ongoing",               label: "Ongoing"           },
  { value: "completed",             label: "Completed"         },
  { value: "cancelled_via_user",    label: "Cancelled (User)"  },
  { value: "cancelled_by_admin_crm",label: "Cancelled (Admin)" },
];
const VIA_OPTIONS = [
  { value: "app",             label: "App"       },
  { value: "website",         label: "Website"   },
  { value: "laptop",          label: "Laptop"    },
  { value: "whatsapp_to_crm", label: "WhatsApp"  },
  { value: "call",            label: "Call"      },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

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

// ── Columns ────────────────────────────────────────────────────────────────────

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

// ── Filter types ───────────────────────────────────────────────────────────────

interface Filters {
  search:         string;
  booking_status: string;
  booking_via:    string;
  branch:         string;
  date_from:      string;
  date_to:        string;
}

const EMPTY: Filters = {
  search: "", booking_status: "", booking_via: "",
  branch: "", date_from: "", date_to: "",
};

// ── FilterContent — shared between desktop dropdown & mobile modal ─────────────

interface FilterContentProps {
  filters:          Filters;
  setFilter:        <K extends keyof Filters>(key: K, val: string) => void;
  clearAllFilters:  () => void;
  activeFilterCount: number;
}

const FilterContent: React.FC<FilterContentProps> = ({
  filters, setFilter, clearAllFilters, activeFilterCount,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <CleanDateRangePicker
      label="Date Range"
      fromValue={filters.date_from}
      toValue={filters.date_to}
      onFromChange={v => setFilter("date_from", v)}
      onToChange={v => setFilter("date_to", v)}
      clearable
      onClear={() => { setFilter("date_from", ""); setFilter("date_to", ""); }}
      stacked
    />

    <div style={{ height: 1, background: "var(--fi-border)", margin: "0 -2px" }} />

    <CleanDropdown
      label="Status"
      value={filters.booking_status}
      options={STATUS_OPTIONS}
      onChange={v => setFilter("booking_status", v)}
      placeholder="All statuses"
      clearable
    />
    <CleanDropdown
      label="Source"
      value={filters.booking_via}
      options={VIA_OPTIONS}
      onChange={v => setFilter("booking_via", v)}
      placeholder="All sources"
      clearable
    />

    {activeFilterCount > 0 && (
      <CleanButton variant="danger" size="xs" onClick={clearAllFilters} style={{ width: "100%" }}>
        Clear all filters
      </CleanButton>
    )}
  </div>
);

// ── Desktop dropdown panel style ───────────────────────────────────────────────

const dropdownPanelStyle: React.CSSProperties = {
  position:     "absolute",
  top:          "calc(100% + 4px)",
  right:        0,
  zIndex:       50,
  background:   "var(--fi-bg-panel)",
  border:       "1px solid var(--fi-border)",
  borderRadius: "var(--fi-radius)",
  boxShadow:    "0 4px 20px rgba(0,0,0,0.10)",
  padding:      14,
  minWidth:     260,
};

// ── useIsMobile ────────────────────────────────────────────────────────────────

const useIsMobile = () => {
  const [v, setV] = React.useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
};

// ── Component ──────────────────────────────────────────────────────────────────

const BookingManagement: React.FC = () => {
  const token    = useSelector(selectAccessToken);
  const dispatch = useDispatch();
  const apiKey   = useSelector((s: RootState) => selectApiKey(s));
  const access   = useSelector((s: RootState) => selectAccessData(s));
  const perms    = (access?.["booking_management"] ?? {}) as Record<string, boolean>;
  const isMobile = useIsMobile();

  const [data,           setData]          = React.useState<BookingApiItem[]>([]);
  const [filters,        setFilters]       = React.useState<Filters>(EMPTY);
  const [debouncedSearch,setDebouncedSearch] = React.useState("");
  const [total,          setTotal]         = React.useState(0);
  const [loading,        setLoading]       = React.useState(false);
  const [loadingMore,    setLoadingMore]   = React.useState(false);
  const [hasMore,        setHasMore]       = React.useState(false);

  // Modal state (create / view / edit)
  const [showModal,       setShowModal]       = React.useState(false);
  const [modalMode,       setModalMode]       = React.useState<"create" | "view" | "edit">("create");
  const [selectedBooking, setSelectedBooking] = React.useState<InitialBookingData | null>(null);

  // Filter panel state
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef       = useRef(1);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const PER_PAGE      = 25;

  // Close desktop panel on outside click (ignore portal popups)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target       = e.target as Element;
      const insidePanel  = filterPanelRef.current?.contains(target);
      const insidePortal = !!target?.closest?.("[data-portal-popup]");
      if (!insidePanel && !insidePortal) setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof Filters>(key: K, val: string) =>
    setFilters(f => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(EMPTY);

  const activeFilterCount = [
    filters.booking_status, filters.booking_via,
    filters.date_from, filters.date_to,
  ].filter(Boolean).length;

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit:          PER_PAGE,
      search:         debouncedSearch || undefined,
      booking_status: filters.booking_status || undefined,
      booking_via:    filters.booking_via    || undefined,
      branch:         filters.branch         || undefined,
      date_from:      filters.date_from      || undefined,
      date_to:        filters.date_to        || undefined,
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
        const res   = await getData<BookingsApiResponse>({
          endpoint: "bookings",
          token,
          instance: "identity",
          params:   buildParams(page),
          signal,
        });
        const items = res.data.data;
        setData(prev => append ? [...prev, ...items] : items);
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch (err: unknown) {
        const name = (err as any)?.name ?? (err as any)?.code;
        if (name === "AbortError" || name === "CanceledError" || (err as any)?.message === "canceled") return;
        showToastnew.error("Failed to fetch bookings");
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

  const openModal = useCallback((mode: "create" | "view" | "edit", row?: BookingApiItem) => {
    setSelectedBooking(row ?? null);
    setModalMode(mode);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedBooking(null);
    setModalMode("create");
  }, []);

  const handleView = useCallback((row: BookingApiItem) => openModal("view", row), [openModal]);
  const handleEdit = useCallback((row: BookingApiItem) => openModal("edit", row), [openModal]);

  // Mobile FAB on /booking-management dispatches this event → open create modal
  useEffect(() => {
    const handler = () => openModal("create");
    window.addEventListener(OPEN_CREATE_BOOKING_EVENT, handler);
    return () => window.removeEventListener(OPEN_CREATE_BOOKING_EVENT, handler);
  }, [openModal]);

  const handleDelete = useCallback(async (row: BookingApiItem) => {
    await deleteData({ endpoint: `bookings/${row._id}`, token, instance: "identity" });
    showToastnew.success("Booking deleted");
    handleRefresh();
  }, [token, handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(
      ids.map(id => deleteData({ endpoint: `bookings/${id}`, token, instance: "identity" }))
    );
    showToastnew.success(`${ids.length} booking${ids.length > 1 ? "s" : ""} deleted`);
    handleRefresh();
  }, [token, handleRefresh]);

  const filterProps: FilterContentProps = {
    filters, setFilter, clearAllFilters, activeFilterCount,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        padding:      "7px 12px",
        borderBottom: "1px solid var(--dt-border)",
        flexShrink:   0,
        background:   "var(--dt-header)",
      }}>

        {/* Search */}
        <CleanSearchBar
          value={filters.search}
          onChange={v => setFilter("search", v)}
          placeholder="Search reference, name, phone…"
          width={isMobile ? undefined : 230}
          style={isMobile ? { flex: 1 } : undefined}
        />

        {/* Combined filter button */}
        <div style={{ position: "relative", flexShrink: 0 }} ref={filterPanelRef}>
          <CleanButton
            variant="outline"
            size="sm"
            active={showFilterPanel}
            icon={isMobile ? <SlidersHorizontal style={{ width: 15, height: 15 }} /> : undefined}
            iconLeft={!isMobile ? <SlidersHorizontal style={{ width: 13, height: 13 }} /> : undefined}
            badge={activeFilterCount > 0 ? activeFilterCount : undefined}
            onClick={() => {
              if (isMobile) setFilterModalOpen(true);
              else setShowFilterPanel(v => !v);
            }}
            style={{ height: "var(--fi-height)" }}
          >
            {isMobile ? undefined : "Filter"}
          </CleanButton>

          {/* Desktop dropdown panel */}
          {!isMobile && showFilterPanel && (
            <div style={dropdownPanelStyle}>
              <FilterContent {...filterProps} />
            </div>
          )}
        </div>

        {/* Export */}
        <CleanButton
          variant="outline"
          size="sm"
          iconLeft={
            <svg style={{ width: 13, height: 13 }} viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M3.5 5l3 3 3-3M1.5 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Export bookings"
        >
          {isMobile ? undefined : "Export"}
        </CleanButton>

        <div style={{ flex: 1 }} />

        {/* Create Booking — hidden on mobile; FAB handles it */}
        {!isMobile && perms.create !== false && (
          <CleanButton
            variant="primary"
            size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => openModal("create")}
            style={{ height: "var(--fi-height)", flexShrink: 0 }}
          >
            Create Booking
          </CleanButton>
        )}
      </div>

      {/* ── Mobile filter modal (bottom sheet) ───────────────────────────── */}
      <CleanModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filters"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : undefined}
        mode="sheet"
        footer={
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            {activeFilterCount > 0 && (
              <CleanButton
                variant="danger"
                size="sm"
                onClick={() => { clearAllFilters(); setFilterModalOpen(false); }}
                style={{ flex: 1 }}
              >
                Clear all
              </CleanButton>
            )}
            <CleanButton
              variant="primary"
              size="sm"
              onClick={() => setFilterModalOpen(false)}
              style={{ flex: 1 }}
            >
              Apply
            </CleanButton>
          </div>
        }
      >
        <FilterContent {...filterProps} />
      </CleanModal>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<BookingApiItem>
          rows={data}
          columns={COLUMNS}
          getRowId={row => row._id}
          isLoading={loading}
          totalItems={total}
          onScrollPagination
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onRefresh={handleRefresh}
          emptyStateImage="/icons/no-booking-found.png"
          emptyStateTitle="No bookings found"
          emptyStateSubtitle="Try adjusting your search or filters"
          selectable={perms.delete !== false}
          onBulkDelete={perms.delete !== false ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected bookings — this cannot be undone"
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
          onClose={closeModal}
          onCreated={() => { closeModal(); handleRefresh(); }}
          onSaved={() => { closeModal(); handleRefresh(); }}
          mode={modalMode}
          initialData={selectedBooking ?? undefined}
        />
      )}
    </div>
  );
};

export default BookingManagement;
