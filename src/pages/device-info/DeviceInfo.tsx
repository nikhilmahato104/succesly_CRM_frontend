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
  CleanResponsiveSearch,
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

// ── Details view — shared by the desktop modal & mobile bottom sheet ───────────

const Field: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div style={{ minWidth: 0 }}>
    <strong>{label}</strong>
    <div style={{
      color: "var(--dt-muted)", wordBreak: "break-all",
      ...(mono ? { fontFamily: "ui-monospace, monospace", fontSize: 11 } : {}),
    }}>
      {children}
    </div>
  </div>
);

const mapLinks = (lat: number, long: number) => ({
  embed: `https://www.google.com/maps?q=${lat},${long}&z=15&output=embed`,
  open:  `https://www.google.com/maps?q=${lat},${long}`,
});

// Small map at the top-right of each mobile card. Non-interactive so a tap still
// opens the details and a long-press still deletes.
const renderCardMap = (row: DeviceInfo) => {
  if (row.lat == null || row.long == null) return null;
  return (
    <iframe
      title={`Map — ${row.reference_id}`}
      src={mapLinks(row.lat, row.long).embed}
      loading="lazy"
      tabIndex={-1}
      style={{ display: "block", width: 96, height: 96, border: 0, borderRadius: "var(--radius)", pointerEvents: "none" }}
    />
  );
};

// The iframe mounts only after the sheet/modal has finished sliding in, then
// fades in once Google has painted — no blank white flash while it animates.
const MAP_MOUNT_DELAY = 500; // ms — matches the vaul sheet transition

const DetailsMap: React.FC<{ title: string; src: string }> = ({ title, src }) => {
  const [mounted, setMounted] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), MAP_MOUNT_DELAY);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ marginTop: 8, height: 240, borderRadius: "var(--radius)", overflow: "hidden", background: "var(--dt-header)" }}>
      {mounted && (
        <iframe
          title={title}
          src={src}
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{ display: "block", width: "100%", height: "100%", border: 0, opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
        />
      )}
    </div>
  );
};

const DeviceDetails: React.FC<{ row: DeviceInfo }> = ({ row }) => {
  const hasCoords = row.lat != null && row.long != null;
  const map = hasCoords ? mapLinks(row.lat as number, row.long as number) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12, color: "var(--dt-text)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Field label="Reference ID" mono>{row.reference_id}</Field>
        <Field label="Device Name">{row.device_name || "—"}</Field>
        <Field label="Device Number">{row.device_number || "—"}</Field>
        <Field label="Website">{row.website_name || "—"}</Field>
        <Field label="Country">{row.country || "—"}</Field>
        <Field label="IP Address" mono>{row.device_ip || "—"}</Field>
        <Field label="Latitude">{row.lat ?? "—"}</Field>
        <Field label="Longitude">{row.long ?? "—"}</Field>
        <Field label="Device Changes">{row.device_change}</Field>
        <Field label="Total Hits">{totalHits(row)}</Field>
        <div><strong>Status</strong><div><ActiveBadge active={row.is_active} /></div></div>
        <Field label="First Seen">{formatDateTime(row.createdAt)}</Field>
        <Field label="Last Seen">{formatDateTime(row.updatedAt)}</Field>
        <Field label="Frontend UUID" mono>{row.frontend_generated_uuid || "—"}</Field>
        <Field label="Record ID" mono>{row._id}</Field>
      </div>

      <div style={{ height: 1, background: "var(--fi-border)" }} />

      {/* Location map */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong>Location Map</strong>
          {map && (
            <a href={map.open} target="_blank" rel="noopener noreferrer" style={{ color: "var(--dt-muted)", textDecoration: "underline" }}>
              Open in Google Maps
            </a>
          )}
        </div>
        {map ? (
          <DetailsMap title={`Map — ${row.reference_id}`} src={map.embed} />
        ) : (
          <div style={{ marginTop: 8, color: "var(--dt-muted)" }}>Location not available for this device</div>
        )}
      </div>

      <div style={{ height: 1, background: "var(--fi-border)" }} />

      {/* Pages visited */}
      <div>
        <strong>Pages Visited ({row.website_all_url_route.length})</strong>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {row.website_all_url_route.map((r, i) => (
            <div key={i} style={{ padding: "8px 10px", background: "var(--dt-header)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ wordBreak: "break-all", minWidth: 0 }}>{r.url}</span>
                <span style={{ flexShrink: 0, color: "var(--dt-muted)" }}>{r.hit_count} hit{r.hit_count !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", color: "var(--dt-muted)", fontSize: 11 }}>
                <span>First hit: {formatDateTime(r.created_at)}</span>
                <span>Last hit: {formatDateTime(r.last_hit_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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

const DEFAULT_PAGE_SIZE = 25;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage,     setPerPage]     = useState(DEFAULT_PAGE_SIZE);

  const [viewRow, setViewRow] = useState<DeviceInfo | null>(null);

  // Desktop: inline dropdown panel; Mobile: CleanModal
  const [showFilterPanel,  setShowFilterPanel]  = useState(false);
  const [filterModalOpen,  setFilterModalOpen]  = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef  = useRef(1);
  const abortRef = useRef<AbortController | null>(null);

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
      limit:    perPage,
      search:   debouncedQ || undefined,
      date_from: filters.date_from || undefined,
      date_to:   filters.date_to   || undefined,
    }),
    [perPage, debouncedQ, filters],
  );

  const fetchPage = useCallback(
    async (page: number) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      pageRef.current = page;

      setCurrentPage(page);

      setLoading(true);
      try {
        const res   = await fetchDeviceInfos({ ...buildParams(page) });
        const items = res.data.data;
        setData(items);
        setTotal(res.data.total);
      } catch (err: unknown) {
        const name = (err as any)?.name ?? (err as any)?.code;
        if (name === "AbortError" || name === "CanceledError" || (err as any)?.message === "canceled") return;
        showToastnew.error("Failed to fetch device info");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
        }
      }
    },
    [apiKey, buildParams, dispatch],
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);
  const handleRefresh  = useCallback(() => { fetchPage(pageRef.current); }, [fetchPage]);

  // A delete emptied the last page → step back to the new last page
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    if (!loading && currentPage > lastPage) fetchPage(lastPage);
  }, [total, perPage, currentPage, loading, fetchPage]);

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

      {/* ── Toolbar — on mobile only the floating filter + search buttons remain ── */}
      {isMobile ? (
        <CleanResponsiveSearch
          value={filters.search}
          onChange={v => setFilter("search", v)}
          placeholder="Search devices…"
          mobileFilter={{ activeCount: activeFilterCount, onClick: () => setFilterModalOpen(true) }}
        />
      ) : (
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
          <CleanResponsiveSearch
            value={filters.search}
            onChange={v => setFilter("search", v)}
            placeholder="Search by device, website, IP, country…"
            style={{ flex: 1, minWidth: 0, height: "var(--fi-height)" }}
          />

          {/* Combined filter button */}
          <div style={{ position: "relative", flexShrink: 0 }} ref={filterPanelRef}>
            <CleanButton
              variant="outline"
              size="sm"
              active={showFilterPanel}
              iconLeft={<SlidersHorizontal style={{ width: 13, height: 13 }} />}
              badge={activeFilterCount > 0 ? activeFilterCount : undefined}
              onClick={() => setShowFilterPanel(v => !v)}
              style={{ height: "var(--fi-height)" }}
            >
              Filter
            </CleanButton>

            {/* Desktop dropdown panel */}
            {showFilterPanel && (
              <div style={dropdownPanelStyle}>
                <FilterContent {...filterProps} />
              </div>
            )}
          </div>
        </div>
      )}

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
        maxWidth={760}
        sheetOpenFull
      >
        {viewRow && <DeviceDetails row={viewRow} />}
      </CleanModal>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<DeviceInfo>
          rows={data}
          columns={COLUMNS}
          getRowId={row => row._id}
          isLoading={loading}
          totalItems={total}
          currentPage={currentPage}
          itemsPerPage={perPage}
          onPageChange={fetchPage}
          onItemsPerPageChange={setPerPage}
          onRefresh={handleRefresh}
          emptyStateImage="/icons/no-booking-found.png"
          emptyStateTitle="No device records found"
          emptyStateSubtitle="Device hits will appear here once visitors are tracked"
          selectable={perms.delete !== false}
          onBulkDelete={perms.delete !== false ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected device records — this cannot be undone"
          onView={handleView}
          renderCardAside={renderCardMap}
          onDelete={perms.delete !== false ? handleDelete : undefined}
          deleteConfirmTitle="Delete device record?"
          deleteConfirmDescription="This will permanently remove this device's tracking history. This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default DeviceInfoPage;
