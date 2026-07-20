import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { SlidersHorizontal } from "lucide-react";

const useIsMobile = () => {
  const [v, setV] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
};
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import {
  CleanButton,
  CleanSearchBar,
  CleanModal,
  CleanDateRangePicker,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectAccessData } from "../../store/slices/accessSlice";
import { openApiKeyModal, selectApiKey } from "../../store/slices/apiKeySlice";
import type { RootState } from "../../store";
import { fetchDeviceInfos, deleteDeviceInfo } from "../../services/deviceInfoApi";
import {
  type DeviceInfo,
  type DeviceInfoFilters,
  EMPTY_FILTERS,
  formatDate,
  formatDateTime,
  totalHits,
} from "./types";

// ── Badge helpers ──────────────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500,
};

const ActiveBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    style={{
      ...pillStyle,
      background: active ? "var(--badge-green-bg)" : "var(--badge-gray-bg)",
      color:      active ? "var(--badge-green-text)" : "var(--badge-gray-text)",
    }}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

// ── Column definitions ─────────────────────────────────────────────────────────

const COLUMNS: GridColumn<DeviceInfo>[] = [
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
    field: "device_name",
    headerName: "Device",
    minWidth: 190,
    sortable: true,
    renderCell: ({ row }) => (
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.device_name || "—"}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.device_number || "—"}
        </p>
      </div>
    ),
  },
  {
    field: "website_name",
    headerName: "Website",
    minWidth: 160,
    sortable: true,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-text)" }}>{row.website_name || "—"}</span>
    ),
  },
  {
    field: "country",
    headerName: "Location",
    minWidth: 130,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-text)" }}>
        {row.country || "—"}
        {row.lat != null && row.long != null && (
          <span style={{ color: "var(--dt-muted)" }}> · {row.lat.toFixed(2)}, {row.long.toFixed(2)}</span>
        )}
      </span>
    ),
  },
  {
    field: "device_ip",
    headerName: "IP Address",
    minWidth: 130,
    renderCell: ({ row }) => (
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--dt-text)" }}>
        {row.device_ip || "—"}
      </span>
    ),
  },
  {
    field: "website_all_url_route",
    headerName: "Pages / Hits",
    minWidth: 130,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-text)" }}>
        {row.website_all_url_route.length} page{row.website_all_url_route.length !== 1 ? "s" : ""} · {totalHits(row)} hit{totalHits(row) !== 1 ? "s" : ""}
      </span>
    ),
  },
  {
    field: "device_change",
    headerName: "Device Changes",
    minWidth: 130,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: row.device_change > 0 ? "#ef4444" : "var(--dt-muted)" }}>
        {row.device_change}
      </span>
    ),
  },
  {
    field: "is_active",
    headerName: "Status",
    minWidth: 100,
    renderCell: ({ row }) => <ActiveBadge active={row.is_active} />,
  },
  {
    field: "updatedAt",
    headerName: "Last Seen",
    minWidth: 120,
    sortable: true,
    renderCell: ({ row }) => (
      <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>{formatDate(row.updatedAt)}</span>
    ),
  },
];

// ── Filter content — shared between desktop dropdown & mobile modal ────────────

interface FilterContentProps {
  filters:          DeviceInfoFilters;
  setFilter:        <K extends keyof DeviceInfoFilters>(key: K, val: string) => void;
  clearAllFilters:  () => void;
  activeFilterCount: number;
}

const FilterContent: React.FC<FilterContentProps> = ({
  filters, setFilter, clearAllFilters, activeFilterCount,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

    {/* Date range */}
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

    {/* Clear all */}
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

// ── Component ──────────────────────────────────────────────────────────────────

const DeviceInfoPage: React.FC = () => {
  const isMobile = useIsMobile();
  const dispatch = useDispatch();
  const apiKey   = useSelector((s: RootState) => selectApiKey(s));
  const access   = useSelector((s: RootState) => selectAccessData(s));
  const perms    = (access?.["device_info"] ?? {}) as Record<string, boolean>;

  const [data,        setData]        = useState<DeviceInfo[]>([]);
  const [filters,     setFilters]     = useState<DeviceInfoFilters>(EMPTY_FILTERS);
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);

  const [viewRow, setViewRow] = useState<DeviceInfo | null>(null);

  // Desktop: inline dropdown panel; Mobile: CleanModal
  const [showFilterPanel,  setShowFilterPanel]  = useState(false);
  const [filterModalOpen,  setFilterModalOpen]  = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef  = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const PER_PAGE = 25;

  // Close desktop panel on outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Element;
      const insidePanel  = filterPanelRef.current?.contains(target);
      const insidePortal = !!target?.closest?.("[data-portal-popup]");
      if (!insidePanel && !insidePortal) setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.search.trim()), 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof DeviceInfoFilters>(key: K, val: string) =>
    setFilters(f => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(EMPTY_FILTERS);

  const activeFilterCount = [filters.date_from, filters.date_to].filter(Boolean).length;

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit:    PER_PAGE,
      search:   debouncedQ || undefined,
      date_from: filters.date_from || undefined,
      date_to:   filters.date_to   || undefined,
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
        const res   = await fetchDeviceInfos({ ...buildParams(page) });
        const items = res.data.data;
        setData(prev => append ? [...prev, ...items] : items);
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch (err: unknown) {
        const name = (err as any)?.name ?? (err as any)?.code;
        if (name === "AbortError" || name === "CanceledError" || (err as any)?.message === "canceled") return;
        showToastnew.error("Failed to fetch device info");
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

  const handleView = useCallback((row: DeviceInfo) => setViewRow(row), []);

  const handleDelete = useCallback(async (row: DeviceInfo) => {
    try {
      await deleteDeviceInfo(row._id);
      showToastnew.success("Device info deleted");
      handleRefresh();
    } catch {
      showToastnew.error("Failed to delete device info");
    }
  }, [handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    try {
      await Promise.all(ids.map(id => deleteDeviceInfo(String(id))));
      showToastnew.success(`${ids.length} record${ids.length > 1 ? "s" : ""} deleted`);
      handleRefresh();
    } catch {
      showToastnew.error("Failed to delete selected records");
    }
  }, [handleRefresh]);

  const filterProps: FilterContentProps = {
    filters, setFilter, clearAllFilters, activeFilterCount,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        padding:      "8px 12px",
        borderBottom: "1px solid var(--dt-border)",
        flexShrink:   0,
        background:   "var(--dt-header)",
      }}>

        {/* Search */}
        <CleanSearchBar
          value={filters.search}
          onChange={v => setFilter("search", v)}
          placeholder={isMobile ? "Search devices…" : "Search by device, website, IP, country…"}
          style={{ flex: 1, minWidth: 0, height: "var(--fi-height)" }}
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
              if (isMobile) {
                setFilterModalOpen(true);
              } else {
                setShowFilterPanel(v => !v);
              }
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

      {/* ── View details modal ───────────────────────────────────────────── */}
      <CleanModal
        isOpen={!!viewRow}
        onClose={() => setViewRow(null)}
        title={viewRow?.device_name || "Device details"}
        subtitle={viewRow?.reference_id}
      >
        {viewRow && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12, color: "var(--dt-text)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><strong>Device Number</strong><div style={{ color: "var(--dt-muted)" }}>{viewRow.device_number || "—"}</div></div>
              <div><strong>Website</strong><div style={{ color: "var(--dt-muted)" }}>{viewRow.website_name || "—"}</div></div>
              <div><strong>Country</strong><div style={{ color: "var(--dt-muted)" }}>{viewRow.country || "—"}</div></div>
              <div><strong>IP Address</strong><div style={{ color: "var(--dt-muted)" }}>{viewRow.device_ip || "—"}</div></div>
              <div><strong>Device Changes</strong><div style={{ color: "var(--dt-muted)" }}>{viewRow.device_change}</div></div>
              <div><strong>Status</strong><div><ActiveBadge active={viewRow.is_active} /></div></div>
              <div><strong>First Seen</strong><div style={{ color: "var(--dt-muted)" }}>{formatDateTime(viewRow.createdAt)}</div></div>
              <div><strong>Last Seen</strong><div style={{ color: "var(--dt-muted)" }}>{formatDateTime(viewRow.updatedAt)}</div></div>
            </div>

            <div style={{ height: 1, background: "var(--fi-border)" }} />

            <div>
              <strong>Pages Visited ({viewRow.website_all_url_route.length})</strong>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {viewRow.website_all_url_route.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 8px", background: "var(--dt-header)", borderRadius: 6 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.url}</span>
                    <span style={{ flexShrink: 0, color: "var(--dt-muted)" }}>{r.hit_count} hit{r.hit_count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CleanModal>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<DeviceInfo>
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
          emptyStateTitle="No device records found"
          emptyStateSubtitle="Device hits will appear here once visitors are tracked"
          selectable={perms.delete !== false}
          onBulkDelete={perms.delete !== false ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected device records — this cannot be undone"
          onView={handleView}
          onDelete={perms.delete !== false ? handleDelete : undefined}
          deleteConfirmTitle="Delete device record?"
          deleteConfirmDescription="This will permanently remove this device's tracking history. This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default DeviceInfoPage;
