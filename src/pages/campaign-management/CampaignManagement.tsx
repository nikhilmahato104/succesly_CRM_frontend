import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { Plus, SlidersHorizontal, BarChart3, Pause, Play } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import {
  CleanButton,
  CleanResponsiveSearch,
  CleanModal,
  CleanDropdown,
  CleanInput,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectAccessData } from "../../store/slices/accessSlice";
import { openApiKeyModal, selectApiKey } from "../../store/slices/apiKeySlice";
import type { RootState } from "../../store";
import { fetchCampaigns, fetchIndustryTypes, archiveCampaign, updateCampaign } from "../../services/campaignApi";
import { CopyButton } from "./ShortLinkCard";
import { CampaignViewSheet } from "./CampaignViewSheet";
import { useIsMobile } from "./useIsMobile";
import {
  type Campaign,
  type CampaignFilters,
  type Option,
  CAMPAIGN_MODULE_ID,
  EMPTY_FILTERS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  STATUS_STYLE,
  apiErrorMessage,
  formatDateTime,
  formatNumber,
  humanize,
  labelFor,
} from "./types";

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500,
};

const ORDER_OPTIONS: Option[] = [
  { value: "desc", label: "Descending" },
  { value: "asc",  label: "Ascending"  },
];

// ── Filter content — shared between desktop dropdown & mobile modal ────────────

interface FilterContentProps {
  filters:           CampaignFilters;
  industries:        Option[];
  setFilter:         <K extends keyof CampaignFilters>(key: K, val: string) => void;
  clearAllFilters:   () => void;
  activeFilterCount: number;
}

const FilterContent: React.FC<FilterContentProps> = ({
  filters, industries, setFilter, clearAllFilters, activeFilterCount,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <CleanDropdown
      label="Industry"
      value={filters.industry_type}
      options={industries}
      onChange={v => setFilter("industry_type", v)}
      placeholder="All industries"
      clearable
    />
    <CleanDropdown
      label="Status"
      value={filters.status}
      options={STATUS_OPTIONS}
      onChange={v => setFilter("status", v)}
      placeholder="Active & paused"
      clearable
    />
    <CleanInput
      label="UTM Source"
      value={filters.utm_source}
      onChange={e => setFilter("utm_source", e.target.value.trim())}
      placeholder="instagram"
    />

    <div style={{ height: 1, background: "var(--fi-border)", margin: "0 -2px" }} />

    <CleanDropdown
      label="Sort by"
      value={filters.sort_by}
      options={SORT_OPTIONS}
      onChange={v => setFilter("sort_by", v || "createdAt")}
    />
    <CleanDropdown
      label="Order"
      value={filters.sort_order}
      options={ORDER_OPTIONS}
      onChange={v => setFilter("sort_order", v || "desc")}
    />

    {activeFilterCount > 0 && (
      <CleanButton variant="danger" size="xs" onClick={clearAllFilters} style={{ width: "100%" }}>
        Clear all filters
      </CleanButton>
    )}
  </div>
);

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

const CampaignManagement: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const dispatch = useDispatch();
  const apiKey   = useSelector((s: RootState) => selectApiKey(s));
  const access   = useSelector((s: RootState) => selectAccessData(s));
  const perms    = (access?.[CAMPAIGN_MODULE_ID] ?? {}) as Record<string, boolean>;

  const [data,        setData]        = useState<Campaign[]>([]);
  const [filters,     setFilters]     = useState<CampaignFilters>(EMPTY_FILTERS);
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [debouncedUtm, setDebouncedUtm] = useState("");
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage,     setPerPage]     = useState(DEFAULT_PAGE_SIZE);
  const [industries,  setIndustries]  = useState<Option[]>([]);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  // Row tap → quick view sheet. The id stays set while the sheet animates closed.
  const [viewId,   setViewId]   = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const viewRow = useMemo(() => data.find(c => c._id === viewId) ?? null, [data, viewId]);

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const pageRef  = useRef(1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchIndustryTypes().then(setIndustries).catch(() => { /* filter just stays empty */ });
  }, []);

  // Close desktop panel on outside click (ignore CleanDropdown portal lists)
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

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.search.trim()), 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedUtm(filters.utm_source), 500);
    return () => clearTimeout(id);
  }, [filters.utm_source]);

  const setFilter = <K extends keyof CampaignFilters>(key: K, val: string) =>
    setFilters(f => ({ ...f, [key]: val }));

  const clearAllFilters = () => setFilters(f => ({ ...EMPTY_FILTERS, search: f.search }));

  const activeFilterCount = [
    filters.industry_type, filters.status, filters.utm_source,
    filters.sort_by !== EMPTY_FILTERS.sort_by ? "1" : "",
    filters.sort_order !== EMPTY_FILTERS.sort_order ? "1" : "",
  ].filter(Boolean).length;

  const buildParams = useCallback(
    (page: number) => ({
      page,
      limit:         perPage,
      search:        debouncedQ,
      industry_type: filters.industry_type,
      status:        filters.status,
      utm_source:    debouncedUtm,
      sort_by:       filters.sort_by,
      sort_order:    filters.sort_order,
    }),
    [perPage, debouncedQ, debouncedUtm, filters.industry_type, filters.status, filters.sort_by, filters.sort_order],
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
        const res = await fetchCampaigns(buildParams(page), signal);
        setData(res.data);
        setTotal(res.total);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        showToastnew.error(apiErrorMessage(err, "Failed to fetch campaigns"));
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

  const handleView = useCallback((row: Campaign) => navigate(`/campaigns/${row._id}`), [navigate]);
  const openQuickView = useCallback((row: Campaign) => { setViewId(row._id); setViewOpen(true); }, []);
  const handleEdit = useCallback((row: Campaign) => {
    if (!row.is_active) { showToastnew.error("Archived campaigns cannot be edited"); return; }
    navigate(`/campaigns/${row._id}/edit`);
  }, [navigate]);

  const handleArchive = useCallback(async (row: Campaign) => {
    try {
      await archiveCampaign(row._id);
      showToastnew.success("Campaign archived");
      handleRefresh();
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to archive campaign"));
    }
  }, [handleRefresh]);

  const handleBulkArchive = useCallback(async (ids: (string | number)[]) => {
    try {
      await Promise.all(ids.map(id => archiveCampaign(String(id))));
      showToastnew.success(`${ids.length} campaign${ids.length > 1 ? "s" : ""} archived`);
      handleRefresh();
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to archive selected campaigns"));
    }
  }, [handleRefresh]);

  // Pause / resume in place — no full reload
  const handleToggleStatus = useCallback(async (row: Campaign) => {
    const next = row.status === "active" ? "paused" : "active";
    setTogglingId(row._id);
    try {
      const res = await updateCampaign(row._id, { status: next });
      setData(prev => prev.map(c => (c._id === row._id ? { ...c, status: res.data.status } : c)));
      showToastnew.success(next === "paused" ? "Link paused" : "Link resumed");
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  }, []);

  const canEdit   = perms.edit   !== false;
  const canDelete = perms.delete !== false;
  const canCreate = perms.create !== false;

  const columns = useMemo<GridColumn<Campaign>[]>(() => [
    {
      field: "name",
      headerName: "Campaign",
      minWidth: 200,
      renderCell: ({ row }) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.name}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", fontFamily: "ui-monospace, monospace" }}>
            {row.reference_id}
          </p>
        </div>
      ),
    },
    {
      field: "short_url",
      headerName: "Short Link",
      minWidth: 230,
      renderCell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }} onClick={e => e.stopPropagation()}>
          <a
            href={row.short_url}
            target="_blank"
            rel="noopener noreferrer"
            title={row.short_url}
            style={{ fontSize: 12, color: "#6366f1", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            {row.short_url.replace(/^https?:\/\//, "")}
          </a>
          <CopyButton text={row.short_url} />
        </div>
      ),
    },
    {
      field: "destination_url",
      headerName: "Destination",
      minWidth: 220,
      renderCell: ({ row }) => {
        let host = row.destination_url;
        let path = "";
        try {
          const u = new URL(row.destination_url);
          host = u.hostname.replace(/^www\./, "");
          path = u.pathname === "/" ? "" : u.pathname;
        } catch { /* show raw value */ }
        return (
          <a
            href={row.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            title={row.destination_url}
            onClick={e => e.stopPropagation()}
            style={{ display: "block", minWidth: 0, textDecoration: "none" }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {host}
            </p>
            {path && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {path}
              </p>
            )}
          </a>
        );
      },
    },
    {
      field: "industry_type",
      headerName: "Industry",
      minWidth: 130,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-text)" }}>{labelFor(industries, row.industry_type)}</span>
      ),
    },
    {
      field: "utm",
      headerName: "Source / Medium",
      minWidth: 160,
      renderCell: ({ row }) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--dt-text)" }}>
            {row.utm.utm_source} <span style={{ color: "var(--dt-muted)" }}>/</span> {row.utm.utm_medium}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.utm.utm_campaign}
          </p>
        </div>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 140,
      renderCell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
          <span style={{ ...pillStyle, ...STATUS_STYLE[row.status] }}>{humanize(row.status)}</span>
          {canEdit && row.is_active && (
            <CleanButton
              variant="ghost"
              size="xs"
              className="no-min-tap"
              style={{ width: 26, height: 26 }}
              loading={togglingId === row._id}
              icon={row.status === "active"
                ? <Pause style={{ width: 13, height: 13 }} />
                : <Play  style={{ width: 13, height: 13 }} />}
              title={row.status === "active" ? "Pause link" : "Resume link"}
              onClick={() => handleToggleStatus(row)}
            />
          )}
        </div>
      ),
    },
    {
      field: "total_clicks",
      headerName: "Clicks",
      minWidth: 110,
      renderCell: ({ row }) => (
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)" }}>{formatNumber(row.total_clicks)}</span>
          <span style={{ fontSize: 11, color: "var(--dt-muted)" }}> · {formatNumber(row.unique_clicks)} unique</span>
        </div>
      ),
    },
    {
      field: "last_clicked_at",
      headerName: "Last Click",
      minWidth: 150,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: row.last_clicked_at ? "var(--dt-text)" : "var(--dt-muted)" }}>
          {formatDateTime(row.last_clicked_at)}
        </span>
      ),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 150,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>{formatDateTime(row.createdAt)}</span>
      ),
    },
  ], [industries, canEdit, togglingId, handleToggleStatus]);

  const filterProps: FilterContentProps = {
    filters, industries, setFilter, clearAllFilters, activeFilterCount,
  };

  const archivedView = filters.status === "archived";

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
        <CleanResponsiveSearch
          value={filters.search}
          onChange={v => setFilter("search", v)}
          placeholder="Search campaigns…"
          mobileFilter={{ activeCount: activeFilterCount, onClick: () => setFilterModalOpen(true) }}
          width={isMobile ? "100%" : 300}
          style={{
            flex:         isMobile ? 1 : "0 1 300px",
            minWidth:     0,
            height:       "var(--fi-height)",
            borderRadius: 99,
            paddingRight: 4,
          }}
        />

        {!isMobile && (
          <span style={{ fontSize: 12, color: "var(--dt-muted)", whiteSpace: "nowrap" }}>
            {formatNumber(total)} campaign{total === 1 ? "" : "s"}
          </span>
        )}
        <div style={{ flex: 1 }} />

        {/* Filter — on mobile it floats above the search button instead */}
        {!isMobile && (
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

            {showFilterPanel && (
              <div style={dropdownPanelStyle}>
                <FilterContent {...filterProps} />
              </div>
            )}
          </div>
        )}

        <CleanButton
          variant="outline"
          size="sm"
          icon={isMobile ? <BarChart3 style={{ width: 15, height: 15 }} /> : undefined}
          iconLeft={!isMobile ? <BarChart3 style={{ width: 13, height: 13 }} /> : undefined}
          onClick={() => navigate("/campaigns/analytics")}
          title="Analytics overview"
          style={{ height: "var(--fi-height)", flexShrink: 0 }}
        >
          {isMobile ? undefined : "Overview"}
        </CleanButton>

        {canCreate && (
          <CleanButton
            variant="primary"
            size="sm"
            icon={isMobile ? <Plus style={{ width: 15, height: 15 }} /> : undefined}
            iconLeft={!isMobile ? <Plus style={{ width: 13, height: 13 }} /> : undefined}
            onClick={() => navigate("/campaigns/new")}
            title="New campaign"
            style={{ height: "var(--fi-height)", flexShrink: 0 }}
          >
            {isMobile ? undefined : "New Campaign"}
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
            <CleanButton variant="primary" size="sm" onClick={() => setFilterModalOpen(false)} style={{ flex: 1 }}>
              Apply
            </CleanButton>
          </div>
        }
      >
        <FilterContent {...filterProps} />
      </CleanModal>

      {/* ── Campaign quick view (bottom sheet on mobile) ───────────────────── */}
      <CampaignViewSheet
        campaign={viewRow}
        isOpen={viewOpen && !!viewRow}
        onClose={() => setViewOpen(false)}
        industries={industries}
        canEdit={canEdit}
        toggling={togglingId === viewId}
        onAnalytics={handleView}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
      />

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<Campaign>
          rows={data}
          columns={columns}
          getRowId={row => row._id}
          isLoading={loading}
          totalItems={total}
          currentPage={currentPage}
          itemsPerPage={perPage}
          onPageChange={fetchPage}
          onItemsPerPageChange={setPerPage}
          onRefresh={handleRefresh}
          emptyStateImage="/icons/no-booking-found.png"
          emptyStateTitle="No campaigns found"
          emptyStateSubtitle="Try adjusting your search or filters, or create a new campaign"
          selectable={canDelete && !archivedView}
          onBulkDelete={canDelete && !archivedView ? handleBulkArchive : undefined}
          bulkDeleteLabel="Archive selected campaigns — their short links stop working, click history is kept"
          onRowClick={openQuickView}
          onView={handleView}
          onEdit={canEdit && !archivedView ? handleEdit : undefined}
          onDelete={canDelete && !archivedView ? handleArchive : undefined}
          deleteConfirmTitle="Archive campaign?"
          deleteConfirmDescription="The short link will stop working. Click history is kept for analytics and the short URL name stays reserved."
        />
      </div>
    </div>
  );
};

export default CampaignManagement;
