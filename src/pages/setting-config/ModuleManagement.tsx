import React, { useCallback, useRef, useMemo } from "react";
import { selectAccessToken } from "../../store/slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { Plus, AlertTriangle } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, deleteData, patchData } from "../../services/crmServices";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import ModuleForm from "./ModuleForm";
import { CleanButton, CleanSearchBar, CleanModal } from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModuleApiItem {
  _id: string; module_id: string; module_name: string; is_active: boolean;
}

interface ModulesApiResponse {
  success: boolean; message: string;
  data: { data: ModuleApiItem[]; total: number; page: number; limit: number; totalPages: number };
}

type ModuleItem = { _id: string; module_id: string; module_name: string; is_active: boolean };
type StatusState = { isOpen: boolean; id: string; name: string; is_active: boolean };

// ── Pure helpers ───────────────────────────────────────────────────────────

const mapModule = (m: ModuleApiItem): ModuleItem =>
  ({ _id: m._id, module_id: m.module_id, module_name: m.module_name, is_active: m.is_active });

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Operation failed";
}

// ── Status badge ───────────────────────────────────────────────────────────

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

const CLOSE_STATUS: StatusState = { isOpen: false, id: "", name: "", is_active: true };
const PER_PAGE = 25;

// ── Component ──────────────────────────────────────────────────────────────

const ModuleManagement: React.FC = () => {
  const token = useSelector(selectAccessToken);
  const dispatch   = useDispatch();
  const apiKey     = useSelector((s: RootState) => selectApiKey(s));
  const access     = useSelector((s: RootState) => selectAccessData(s));
  const perms      = (access?.["module_management"] ?? {}) as Record<string, boolean>;

  const [data,            setData]            = React.useState<ModuleItem[]>([]);
  const [search,          setSearch]          = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [total,           setTotal]           = React.useState(0);
  const [loading,         setLoading]         = React.useState(false);
  const [loadingMore,     setLoadingMore]     = React.useState(false);
  const [hasMore,         setHasMore]         = React.useState(false);
  const [showModal,       setShowModal]       = React.useState(false);
  const [editItem,        setEditItem]        = React.useState<ModuleItem | null>(null);
  const [statusModal,     setStatusModal]     = React.useState<StatusState>(CLOSE_STATUS);
  const [statusLoading,   setStatusLoading]   = React.useState(false);
  const [formSubmitting,  setFormSubmitting]  = React.useState(false);

  const pageRef          = useRef(1);
  const formResetRef     = useRef<(() => void) | null>(null);
  const MODULE_FORM_ID   = "module-mgmt-form";

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const buildParams = useCallback(
    (page: number) => ({ page, limit: PER_PAGE, search: debouncedSearch || undefined }),
    [debouncedSearch],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!apiKey) { dispatch(openApiKeyModal(false)); return; }
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await getData<ModulesApiResponse>({
          endpoint: "modules", token: token, instance: "identity", params: buildParams(page),
        });
        const items = res.data.data.map(mapModule);
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch { showToastnew.error("Failed to fetch modules"); }
      finally   { append ? setLoadingMore(false) : setLoading(false); }
    },
    [apiKey, token, buildParams, dispatch],
  );

  React.useEffect(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleEdit   = useCallback((row: ModuleItem) => { setEditItem(row); setShowModal(true); }, []);
  const handleDelete = useCallback(async (row: ModuleItem) => {
    await deleteData({ endpoint: `modules/${row._id}`, token: token, instance: "identity" });
    showToastnew.success("Module deleted successfully");
    handleRefresh();
  }, [token, handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(ids.map((id) => deleteData({ endpoint: `modules/${id}`, token: token, instance: "identity" })));
    showToastnew.success(`${ids.length} module${ids.length > 1 ? "s" : ""} deleted`);
    handleRefresh();
  }, [token, handleRefresh]);

  const handleStatusToggle = async () => {
    if (!statusModal.id) return;
    setStatusLoading(true);
    try {
      await patchData({
        endpoint: `modules/${statusModal.id}`, token: token, instance: "identity",
        data: { is_active: !statusModal.is_active },
      });
      showToastnew.success(statusModal.is_active ? "Module deactivated" : "Module activated");
      setStatusModal(CLOSE_STATUS);
      handleRefresh();
    } catch (err: unknown) { showToastnew.error(extractErrorMessage(err)); }
    finally { setStatusLoading(false); }
  };

  const columns = useMemo<GridColumn<ModuleItem>[]>(() => [
    {
      field: "module_id", headerName: "Module ID", minWidth: 180, sortable: true,
      renderCell: ({ row }) => (
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--dt-dim)" }}>
          {row.module_id}
        </span>
      ),
    },
    { field: "module_name", headerName: "Module Name", minWidth: 200, sortable: true },
    {
      field: "is_active", headerName: "Status", minWidth: 120,
      renderCell: ({ row }) => (
        <button
          type="button"
          onClick={() => setStatusModal({ isOpen: true, id: row._id, name: row.module_name, is_active: row.is_active })}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          title={row.is_active ? "Click to deactivate" : "Click to activate"}
        >
          <StatusBadge is_active={row.is_active} />
        </button>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          placeholder="Search by module name or ID"
          width={260}
        />

        <div style={{ flex: 1 }} />

        {perms.create && (
          <CleanButton
            variant="primary" size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => { setEditItem(null); setShowModal(true); }}
          >
            Create Module
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<ModuleItem>
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
          bulkDeleteLabel="Delete selected modules — roles using these will lose access"
          onEdit={perms.edit ? handleEdit : undefined}
          onDelete={perms.delete ? handleDelete : undefined}
          deleteConfirmTitle="Delete module?"
          deleteConfirmDescription="This will permanently remove the module. Roles using it will lose access."
        />
      </div>

      {/* ── Create / Edit modal ───────────────────────────────────────────────── */}
      <CleanModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); setFormSubmitting(false); }}
        title={editItem ? "Edit Module" : "Create Module"}
        subtitle={editItem ? "Update module name or status" : "Define a new permission module"}
        maxWidth={480}
        expandable={false}
        zIndex={99999}
        footer={
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
              form={MODULE_FORM_ID}
              variant="primary"
              size="sm"
              loading={formSubmitting}
            >
              {editItem ? "Update Module" : "Create Module"}
            </CleanButton>
          </>
        }
      >
        <ModuleForm
          formId={MODULE_FORM_ID}
          token={token}
          initialValues={editItem ?? undefined}
          onSuccess={() => { setShowModal(false); setEditItem(null); setFormSubmitting(false); handleRefresh(); }}
          onSubmittingChange={setFormSubmitting}
          onResetReady={(fn) => { formResetRef.current = fn; }}
        />
      </CleanModal>

      {/* ── Status toggle modal ───────────────────────────────────────────────── */}
      <CleanModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal(CLOSE_STATUS)}
        maxWidth={400}
        expandable={false}
        zIndex={99999}
        closeOnBackdrop={!statusLoading}
        footer={
          <>
            <span />
            <div style={{ display: "flex", gap: 8 }}>
              <CleanButton variant="outline" size="sm" onClick={() => setStatusModal(CLOSE_STATUS)} disabled={statusLoading}>
                Cancel
              </CleanButton>
              <CleanButton variant="primary" size="sm" onClick={handleStatusToggle} loading={statusLoading}>
                {statusModal.is_active ? "Deactivate" : "Activate"}
              </CleanButton>
            </div>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "var(--fi-text)" }}>
              {statusModal.is_active ? "Deactivate" : "Activate"} Module
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fi-muted)", lineHeight: 1.5 }}>
              Are you sure you want to {statusModal.is_active ? "deactivate" : "activate"}{" "}
              <strong>{statusModal.name}</strong>?
            </p>
          </div>
        </div>
      </CleanModal>
    </div>
  );
};

export default ModuleManagement;
