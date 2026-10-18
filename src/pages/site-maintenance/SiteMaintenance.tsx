import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { AlertTriangle, ExternalLink, Plus, SlidersHorizontal } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import {
  CleanButton,
  CleanResponsiveSearch,
  CleanModal,
  CleanDropdown,
  CleanSwitch,
  CleanTextarea,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectAccessData } from "../../store/slices/accessSlice";
import { openApiKeyModal, selectApiKey } from "../../store/slices/apiKeySlice";
import type { RootState } from "../../store";
import { useDevice } from "../../hooks/useDevice";
import { fetchSites, updateSite, deleteSite } from "../../services/siteMaintenanceApi";
import SiteViewSheet from "./SiteViewSheet";
import {
  type Site,
  type SiteFilters,
  SITE_MAINTENANCE_MODULE_ID,
  EMPTY_FILTERS,
  MODE_OPTIONS,
  RECORD_OPTIONS,
  MODE_STYLE,
  MODE_LABEL,
  modeKey,
  apiErrorMessage,
  formatDateTime,
} from "./types";

// ── Badge ──────────────────────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
};

export const SiteModeBadge: React.FC<{ site: Pick<Site, "is_active" | "is_maintenance_mode"> }> = ({ site }) => {
  const key = modeKey(site);
  return <span style={{ ...pillStyle, ...MODE_STYLE[key] }}>{MODE_LABEL[key]}</span>;
};

// ── Filter content — shared between desktop dropdown & mobile sheet ───────────

interface FilterContentProps {
  filters:           SiteFilters;
  setFilter:         <K extends keyof SiteFilters>(key: K, val: SiteFilters[K]) => void;
  clearAllFilters:   () => void;
  activeFilterCount: number;
}

const FilterContent: React.FC<FilterContentProps> = ({ filters, setFilter, clearAllFilters, activeFilterCount }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <CleanDropdown
      label="Maintenance"
      value={filters.is_maintenance_mode}
      options={MODE_OPTIONS}
      onChange={v => setFilter("is_maintenance_mode", v as SiteFilters["is_maintenance_mode"])}
      placeholder="All sites"
      clearable
    />
    <CleanDropdown
      label="Records"
      value={filters.is_active}
      options={RECORD_OPTIONS}
      onChange={v => setFilter("is_active", (v || "true") as SiteFilters["is_active"])}
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

// ── Maintenance on/off confirm ────────────────────────────────────────────────

interface ToggleTarget { site: Site; next: boolean }

const MaintenanceToggleModal: React.FC<{
  target:    ToggleTarget | null;
  loading:   boolean;
  onClose:   () => void;
  onConfirm: (message: string) => void;
}> = ({ target, loading, onClose, onConfirm }) => {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (target) setMessage(target.site.maintenance_message ?? "");
  }, [target]);

  const turningOn = !!target?.next;

  return (
    <CleanModal
      isOpen={!!target}
      onClose={onClose}
      title={turningOn ? "Turn maintenance ON" : "Turn maintenance OFF"}
      subtitle={target?.site.site_name}
      maxWidth={460}
      expandable={false}
      closeOnBackdrop={!loading}
      zIndex={99999}
      footer={
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <CleanButton variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</CleanButton>
            <CleanButton
              variant={turningOn ? "danger" : "primary"}
              size="sm"
              loading={loading}
              onClick={() => onConfirm(message)}
            >
              {turningOn ? "Take site down" : "Bring site back"}
            </CleanButton>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: turningOn ? "#f59e0b" : "#22c55e", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--fi-muted)", lineHeight: 1.5 }}>
            {turningOn
              ? <>Visitors of <strong style={{ color: "var(--fi-text)" }}>{target?.site.normalized_url}</strong> will see the maintenance page on their next status check — no deploy needed.</>
              : <><strong style={{ color: "var(--fi-text)" }}>{target?.site.normalized_url}</strong> will render normally again on its next status check.</>}
          </p>
        </div>
        {turningOn && (
          <CleanTextarea
            label="Message visitors see"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            hint="Leave empty to use the default wording."
            placeholder="We are upgrading our booking system. Back by 6 PM IST."
          />
        )}
      </div>
    </CleanModal>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

const DEFAULT_PER_PAGE = 25;

const SiteMaintenance: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const dispatch = useDispatch();
  const apiKey   = useSelector((s: RootState) => selectApiKey(s));
  const access   = useSelector((s: RootState) => selectAccessData(s));
  const perms    = (access?.[SITE_MAINTENANCE_MODULE_ID] ?? {}) as Record<string, boolean>;
  const canCreate = perms.create !== false;
  const canEdit   = perms.edit   !== false;
  const canDelete = perms.delete !== false;

  const [data,        setData]        = useState<Site[]>([]);
  const [filters,     setFilters]     = useState<SiteFilters>(EMPTY_FILTERS);
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);

  // Server pagination — one page of rows at a time
  const [page,      setPage]      = useState(1);
  const [perPage,   setPerPage]   = useState(DEFAULT_PER_PAGE);
  const [reloadKey, setReloadKey] = useState(0);

  // Desktop: inline dropdown panel; Mobile: bottom sheet
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const [toggleTarget,  setToggleTarget]  = useState<ToggleTarget | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Row tap → view sheet. The id stays set while the sheet animates closed.
  const [viewId,   setViewId]   = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const viewSite = useMemo(() => data.find(s => s._id === viewId) ?? null, [data, viewId]);

  const abortRef = useRef<AbortController | null>(null);

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

  // Any new search / filter starts again from page 1
  useEffect(() => {
    const next = filters.search.trim();
    const id = setTimeout(() => { setDebouncedQ(next); setPage(1); }, 500);
    return () => clearTimeout(id);
  }, [filters.search]);

  const setFilter = <K extends keyof SiteFilters>(key: K, val: SiteFilters[K]) => {
    setFilters(f => ({ ...f, [key]: val }));
    if (key !== "search") setPage(1);
  };

  const clearAllFilters = () => {
    setFilters(f => ({ ...EMPTY_FILTERS, search: f.search }));
    setPage(1);
  };

  const activeFilterCount = [
    filters.is_maintenance_mode,
    filters.is_active !== EMPTY_FILTERS.is_active ? "1" : "",
  ].filter(Boolean).length;

  const deactivatedView = filters.is_active === "false";

  // ── Fetch the current page ────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) { dispatch(openApiKeyModal(false)); return; }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    fetchSites({
      page,
      limit:               perPage,
      search:              debouncedQ,
      is_maintenance_mode: filters.is_maintenance_mode,
      is_active:           filters.is_active,
    }, controller.signal)
      .then(res => {
        // A delete emptied the last page → step back to the new last page
        if (res.data.length === 0 && page > 1 && res.total > 0) {
          setPage(Math.max(1, res.totalPages));
          return;
        }
        setData(res.data);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        showToastnew.error(apiErrorMessage(err, "Failed to fetch sites"));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
      });

    return () => controller.abort();
  }, [apiKey, dispatch, page, perPage, debouncedQ, filters.is_maintenance_mode, filters.is_active, reloadKey]);

  const handleRefresh = useCallback(() => setReloadKey(k => k + 1), []);

  const handlePerPageChange = useCallback((n: number) => {
    setPerPage(n);
    setPage(1);
  }, []);

  const openView   = useCallback((row: Site) => { setViewId(row._id); setViewOpen(true); }, []);
  const handleEdit = useCallback((row: Site) => navigate(`/site-maintenance/${row._id}/edit`), [navigate]);

  const handleDelete = useCallback(async (row: Site) => {
    try {
      await deleteSite(row._id);
      showToastnew.success("Site deleted");
      handleRefresh();
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to delete site"));
    }
  }, [handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    try {
      await Promise.all(ids.map(id => deleteSite(String(id))));
      showToastnew.success(`${ids.length} site${ids.length > 1 ? "s" : ""} deleted`);
      handleRefresh();
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to delete selected sites"));
    }
  }, [handleRefresh]);

  // The switch — patch in place, no full reload
  const confirmToggle = useCallback(async (message: string) => {
    if (!toggleTarget) return;
    const { site, next } = toggleTarget;
    setToggleLoading(true);
    try {
      const res = await updateSite(site._id, {
        is_maintenance_mode: next,
        ...(next && { maintenance_message: message.trim() }),
      });
      setData(prev => prev.map(s => (s._id === site._id ? { ...s, ...res.data } : s)));
      showToastnew.success(next ? `${site.site_name} is now under maintenance` : `${site.site_name} is live again`);
      setToggleTarget(null);
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to update maintenance mode"));
    } finally {
      setToggleLoading(false);
    }
  }, [toggleTarget]);

  const requestToggle = useCallback((site: Site) => setToggleTarget({ site, next: !site.is_maintenance_mode }), []);

  const columns = useMemo<GridColumn<Site>[]>(() => [
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
      field: "site_name",
      headerName: "Site",
      minWidth: 220,
      renderCell: ({ row }) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--dt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.site_name}
          </p>
          <a
            href={row.site_url}
            target="_blank"
            rel="noopener noreferrer"
            title={row.site_url}
            onClick={e => e.stopPropagation()}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%", fontSize: 11, color: "#6366f1", textDecoration: "none" }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.site_url.replace(/^https?:\/\//, "")}</span>
            <ExternalLink style={{ width: 10, height: 10, flexShrink: 0 }} />
          </a>
        </div>
      ),
    },
    {
      field: "is_maintenance_mode",
      headerName: "Maintenance",
      minWidth: 170,
      renderCell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
          {canEdit && row.is_active && (
            <CleanSwitch
              size="sm"
              checked={row.is_maintenance_mode}
              onColor="#f59e0b"
              loading={toggleLoading && toggleTarget?.site._id === row._id}
              onChange={() => requestToggle(row)}
              ariaLabel={row.is_maintenance_mode ? "Turn maintenance off" : "Turn maintenance on"}
            />
          )}
          <SiteModeBadge site={row} />
        </div>
      ),
    },
    {
      field: "maintenance_message",
      headerName: "Message",
      minWidth: 240,
      renderCell: ({ row }) => (
        <span title={row.maintenance_message} style={{ display: "block", fontSize: 12, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.maintenance_message || "—"}
        </span>
      ),
    },
    {
      field: "normalized_url",
      headerName: "Matched as",
      minWidth: 170,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-text)", fontFamily: "ui-monospace, monospace" }}>{row.normalized_url}</span>
      ),
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 150,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>{formatDateTime(row.updatedAt)}</span>
      ),
    },
  ], [canEdit, toggleLoading, toggleTarget, requestToggle]);

  const filterProps: FilterContentProps = { filters, setFilter, clearAllFilters, activeFilterCount };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar — on mobile only the floating filter + search buttons remain ── */}
      {isMobile ? (
        <CleanResponsiveSearch
          value={filters.search}
          onChange={v => setFilter("search", v)}
          placeholder="Search sites…"
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
          <CleanResponsiveSearch
            value={filters.search}
            onChange={v => setFilter("search", v)}
            placeholder="Search name, url, reference ID…"
            style={{ flex: 1, minWidth: 0, height: "var(--fi-height)" }}
          />

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

          {canCreate && (
            <CleanButton
              variant="primary"
              size="sm"
              iconLeft={<Plus style={{ width: 13, height: 13 }} />}
              onClick={() => navigate("/site-maintenance/new")}
              style={{ height: "var(--fi-height)", flexShrink: 0 }}
            >
              Register Site
            </CleanButton>
          )}
        </div>
      )}

      {/* ── Mobile filter sheet ──────────────────────────────────────────── */}
      <CleanModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filters"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : undefined}
        mode="sheet"
        expandable={false}
        closeOnBackdrop
        footer={
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            {activeFilterCount > 0 && (
              <CleanButton variant="danger" size="sm" onClick={() => { clearAllFilters(); setFilterModalOpen(false); }} style={{ flex: 1 }}>
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

      {/* ── Maintenance switch confirm ───────────────────────────────────── */}
      <MaintenanceToggleModal
        target={toggleTarget}
        loading={toggleLoading}
        onClose={() => { if (!toggleLoading) setToggleTarget(null); }}
        onConfirm={confirmToggle}
      />

      {/* ── View sheet (bottom sheet on mobile) ──────────────────────────── */}
      <SiteViewSheet
        site={viewSite}
        isOpen={viewOpen && !!viewSite}
        onClose={() => setViewOpen(false)}
        canEdit={canEdit}
        onEdit={handleEdit}
        onToggle={site => { setViewOpen(false); requestToggle(site); }}
      />

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<Site>
          rows={data}
          columns={columns}
          getRowId={row => row._id}
          isLoading={loading}
          totalItems={total}
          currentPage={page}
          itemsPerPage={perPage}
          onPageChange={setPage}
          onItemsPerPageChange={handlePerPageChange}
          onRefresh={handleRefresh}
          emptyStateImage="/icons/no-booking-found.png"
          emptyStateTitle={deactivatedView ? "No deactivated sites" : "No sites registered"}
          emptyStateSubtitle="Try adjusting your search or filters, or register a new site"
          selectable={canDelete}
          onBulkDelete={canDelete ? handleBulkDelete : undefined}
          bulkDeleteLabel="Delete selected sites — their urls will report as live"
          onRowClick={openView}
          onView={openView}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canDelete ? handleDelete : undefined}
          deleteConfirmTitle="Delete site?"
          deleteConfirmDescription="The record is removed permanently and this url will report as live. To pause it instead, edit the site and switch off “Active record”."
        />
      </div>
    </div>
  );
};

export default SiteMaintenance;
