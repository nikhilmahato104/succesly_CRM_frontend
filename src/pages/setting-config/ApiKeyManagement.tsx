import React, { useCallback, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectAccessToken } from "../../store/slices/authSlice";
import { ListFilter, Plus, AlertTriangle } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, deleteData } from "../../services/crmServices";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import { scrollToTop } from "../../utils/scrollToTop";
import type { RootState } from "../../store";
import ApiKeyForm, { KeyRevealBanner } from "./ApiKeyForm";
import {
  CleanButton, CleanSearchBar, CleanSelect, CleanModal, type SelectOption,
} from "../../atoms/my_clean_code_atoms";
import { OPEN_CREATE_APIKEY_EVENT } from "../../organisms/MobileBottomBar";

// ── Types ──────────────────────────────────────────────────────────────────

interface ApiKeyApiItem {
  _id: string;
  name: string;
  key?: string;
  is_active: boolean;
  usage_limit?: number;
  usage_count?: number;
  expires_at?: string;
  created_by?: string;
  createdAt?: string;
}

interface ApiKeysApiResponse {
  success: boolean;
  message: string;
  data: {
    data: ApiKeyApiItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type ApiKeyItem = {
  _id: string;
  name: string;
  is_active: boolean;
  usage_limit?: number;
  usage_count?: number;
  expires_at?: string;
  createdAt?: string;
};

type DeleteModalState = { isOpen: boolean; id: string | null; name: string };

// ── Helpers ────────────────────────────────────────────────────────────────

function mapApiKey(k: ApiKeyApiItem): ApiKeyItem {
  return {
    _id: k._id,
    name: k.name,
    is_active: k.is_active,
    usage_limit: k.usage_limit,
    usage_count: k.usage_count,
    expires_at: k.expires_at,
    createdAt: k.createdAt,
  };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Operation failed";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ is_active }: { is_active: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: is_active ? "var(--badge-green-bg)" : "var(--badge-red-bg)",
      color:      is_active ? "var(--badge-green-text)" : "var(--badge-red-text)",
    }}>
      {is_active ? "Active" : "Inactive"}
    </span>
  );
}

// ── Statics ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
  { value: "true",  label: "Active"   },
  { value: "false", label: "Inactive" },
];

const panelStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
  background: "var(--fi-bg-panel)", border: "1px solid var(--fi-border)",
  borderRadius: "var(--fi-radius)", boxShadow: "0 4px 20px rgba(0,0,0,0.10)", padding: 12,
};

const CLOSE_DELETE: DeleteModalState = { isOpen: false, id: null, name: "" };
const PER_PAGE = 25;

// ── Component ──────────────────────────────────────────────────────────────

const ApiKeyManagement: React.FC = () => {
  const token = useSelector(selectAccessToken);
  const dispatch  = useDispatch();
  const apiKey    = useSelector((s: RootState) => selectApiKey(s));
  const access    = useSelector((s: RootState) => selectAccessData(s));
  const perms     = (access?.["api_key_management"] ?? {}) as Record<string, boolean>;

  const [data,            setData]            = React.useState<ApiKeyItem[]>([]);
  const [search,          setSearch]          = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter,    setStatusFilter]    = React.useState("");
  const [total,           setTotal]           = React.useState(0);
  const [loading,         setLoading]         = React.useState(false);
  const [loadingMore,     setLoadingMore]     = React.useState(false);
  const [hasMore,         setHasMore]         = React.useState(false);
  const [showModal,       setShowModal]       = React.useState(false);
  const [editItem,        setEditItem]        = React.useState<ApiKeyItem | null>(null);
  const [deleteModal,     setDeleteModal]     = React.useState<DeleteModalState>(CLOSE_DELETE);
  const [deleteLoading,   setDeleteLoading]   = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const [formSubmitting,  setFormSubmitting]  = React.useState(false);
  const [revealedKey,     setRevealedKey]     = React.useState<string | null>(null);
  const [isMobile,        setIsMobile]        = React.useState(() => window.innerWidth < 1024);

  const pageRef        = useRef(1);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const formResetRef   = useRef<(() => void) | null>(null);
  const APIKEY_FORM_ID = "apikey-mgmt-form";

  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node))
        setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildParams = useCallback(
    (page: number) => ({
      page, limit: PER_PAGE,
      search:    debouncedSearch || undefined,
      is_active: statusFilter   || undefined,
    }),
    [debouncedSearch, statusFilter],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await getData<ApiKeysApiResponse>({
          endpoint: "api-keys",
          token: token,
          instance: "identity",
          params: buildParams(page),
        });
        const items = res.data.data.map(mapApiKey);
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch {
        showToastnew.error("Failed to fetch API keys");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [apiKey, token, buildParams, dispatch],
  );

  React.useEffect(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleEdit   = useCallback((row: ApiKeyItem) => { scrollToTop(); setEditItem(row); setShowModal(true); }, []);

  // Mobile FAB on /setting-config/api-key-management dispatches this event
  React.useEffect(() => {
    const handler = () => { setEditItem(null); setShowModal(true); };
    window.addEventListener(OPEN_CREATE_APIKEY_EVENT, handler);
    return () => window.removeEventListener(OPEN_CREATE_APIKEY_EVENT, handler);
  }, []);

  const handleDelete = useCallback((row: ApiKeyItem) => {
    setDeleteModal({ isOpen: true, id: row._id, name: row.name });
  }, []);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(ids.map((id) => deleteData({ endpoint: `api-keys/${id}`, token: token, instance: "identity" })));
    showToastnew.success(`${ids.length} key${ids.length > 1 ? "s" : ""} deactivated`);
    handleRefresh();
  }, [token, handleRefresh]);

  const handleDeactivate = async () => {
    if (!deleteModal.id) return;
    setDeleteLoading(true);
    try {
      await deleteData({ endpoint: `api-keys/${deleteModal.id}`, token: token, instance: "identity" });
      showToastnew.success("API key deactivated");
      setDeleteModal(CLOSE_DELETE);
      handleRefresh();
    } catch (err: unknown) {
      showToastnew.error(extractErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const activeFilterCount = statusFilter ? 1 : 0;

  const columns = useMemo<GridColumn<ApiKeyItem>[]>(() => [
    { field: "name",      headerName: "Name",    minWidth: 200, sortable: true },
    {
      field: "is_active", headerName: "Status",  minWidth: 120,
      renderCell: ({ row }) => <StatusBadge is_active={row.is_active} />,
    },
    {
      field: "usage_count", headerName: "Usage", minWidth: 130,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-dim)" }}>
          {row.usage_count ?? 0}{row.usage_limit != null ? ` / ${row.usage_limit}` : ""}
        </span>
      ),
    },
    {
      field: "expires_at", headerName: "Expires", minWidth: 140,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-dim)" }}>{formatDate(row.expires_at)}</span>
      ),
    },
    {
      field: "createdAt", headerName: "Created", minWidth: 140,
      renderCell: ({ row }) => (
        <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>{formatDate(row.createdAt)}</span>
      ),
    },
  ], []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderBottom: "1px solid var(--fi-border)",
        flexShrink: 0, flexWrap: "wrap", background: "var(--fi-bg)",
      }}>

        <CleanSearchBar
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search API key by name"
          width={260}
        />

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
            <div style={{ ...panelStyle, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fi-muted)" }}>
                Filters
              </span>
              <CleanSelect
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={STATUS_OPTIONS}
                placeholder="All statuses"
              />
              {activeFilterCount > 0 && (
                <CleanButton variant="danger" size="xs" onClick={() => setStatusFilter("")} style={{ width: "100%" }}>
                  Clear filters
                </CleanButton>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {!isMobile && perms.create && (
          <CleanButton
            variant="primary" size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => { setEditItem(null); setShowModal(true); }}
          >
            Create API Key
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<ApiKeyItem>
          rows={data}
          columns={columns}
          getRowId={(row) => row._id}
          isLoading={loading}
          totalItems={total}
          onScrollPagination
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onRefresh={handleRefresh}
          selectable={perms.delete}
          onBulkDelete={perms.delete ? handleBulkDelete : undefined}
          bulkDeleteLabel="Deactivate selected keys — this cannot be undone"
          onEdit={perms.edit ? handleEdit : undefined}
          onDelete={perms.delete ? handleDelete : undefined}
          deleteConfirmTitle="Deactivate API key?"
          deleteConfirmDescription="This key will be deactivated and will no longer work for API requests."
        />
      </div>

      {/* ── Create / Edit modal ───────────────────────────────────────────────── */}
      <CleanModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); setFormSubmitting(false); setRevealedKey(null); }}
        title={editItem ? "Edit API Key" : "Create API Key"}
        subtitle={
          revealedKey
            ? "Copy your key before closing — it won't be shown again"
            : editItem ? "Update key settings" : "Keys are shown only once at creation"
        }
        maxWidth={520}
        expandable={false}
        zIndex={99999}
        footer={
          revealedKey ? (
            /* After creation: just a "Done" button */
            <>
              <span />
              <CleanButton
                variant="primary"
                size="sm"
                onClick={() => { setShowModal(false); setEditItem(null); setRevealedKey(null); setFormSubmitting(false); }}
              >
                Done
              </CleanButton>
            </>
          ) : (
            /* Normal create / edit footer */
            <>
              <CleanButton
                type="button"
                variant="outline"
                size="sm"
                disabled={formSubmitting}
                onClick={() => formResetRef.current?.()}
              >
                Reset
              </CleanButton>
              <CleanButton
                type="submit"
                form={APIKEY_FORM_ID}
                variant="primary"
                size="sm"
                loading={formSubmitting}
              >
                {editItem ? "Update Key" : "Create API Key"}
              </CleanButton>
            </>
          )
        }
      >
        {revealedKey ? (
          <KeyRevealBanner apiKey={revealedKey} />
        ) : (
          <ApiKeyForm
            formId={APIKEY_FORM_ID}
            token={token}
            initialValues={editItem ?? undefined}
            onSuccess={() => { setShowModal(false); setEditItem(null); setRevealedKey(null); setFormSubmitting(false); handleRefresh(); }}
            onCreated={() => { handleRefresh(); }}
            onSubmittingChange={setFormSubmitting}
            onResetReady={(fn) => { formResetRef.current = fn; }}
            onKeyRevealed={(key) => { setRevealedKey(key); setFormSubmitting(false); }}
          />
        )}
      </CleanModal>

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      <CleanModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(CLOSE_DELETE)}
        maxWidth={400}
        expandable={false}
        zIndex={99999}
        closeOnBackdrop={!deleteLoading}
        footer={
          <>
            <span />
            <div style={{ display: "flex", gap: 8 }}>
              <CleanButton variant="outline" size="sm" onClick={() => setDeleteModal(CLOSE_DELETE)} disabled={deleteLoading}>
                Cancel
              </CleanButton>
              <CleanButton variant="danger" size="sm" onClick={handleDeactivate} loading={deleteLoading}>
                Deactivate
              </CleanButton>
            </div>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "var(--fi-text)" }}>
              Deactivate API Key
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fi-muted)", lineHeight: 1.5 }}>
              Are you sure you want to deactivate <strong>{deleteModal.name}</strong>? This key will stop working immediately.
            </p>
          </div>
        </div>
      </CleanModal>
    </div>
  );
};

export default ApiKeyManagement;
