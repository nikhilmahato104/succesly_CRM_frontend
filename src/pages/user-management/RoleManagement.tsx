import React, { useCallback, useRef, useMemo } from "react";
import { selectAccessToken } from "../../store/slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { Plus } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, deleteData } from "../../services/crmServices";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import RoleForm from "./RoleForm";
import { ActionSetBadge } from "./Permissionsbottomsheet";
import { CleanButton, CleanSearchBar, CleanModal } from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────

interface RoleApiItem {
  _id: string; role_name: string; role_access?: RoleAccess[]; is_active: boolean;
}

interface RolesApiResponse {
  success: boolean; message: string;
  data: { data: RoleApiItem[]; total: number; page: number; limit: number; totalPages: number };
}

type RoleAccess = {
  module_id: string;
  create?: boolean; edit?: boolean; view?: boolean;
  delete?: boolean; transfer?: boolean; export?: boolean;
};

type RoleItem = { _id: string; role_name: string; role_access?: RoleAccess[] | null };

// ── Pure helpers ───────────────────────────────────────────────────────────

const mapRole = (r: RoleApiItem): RoleItem =>
  ({ _id: r._id, role_name: r.role_name, role_access: r.role_access ?? null });

const PER_PAGE = 25;

// ── Component ──────────────────────────────────────────────────────────────

const RoleManagement: React.FC = () => {
  const token = useSelector(selectAccessToken);
  const dispatch   = useDispatch();
  const apiKey     = useSelector((s: RootState) => selectApiKey(s));
  const access     = useSelector((s: RootState) => selectAccessData(s));
  const perms      = (access?.["role_management"] ?? {}) as Record<string, boolean>;

  const [data,            setData]            = React.useState<RoleItem[]>([]);
  const [search,          setSearch]          = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [total,           setTotal]           = React.useState(0);
  const [loading,         setLoading]         = React.useState(false);
  const [loadingMore,     setLoadingMore]     = React.useState(false);
  const [hasMore,         setHasMore]         = React.useState(false);
  const [showModal,       setShowModal]       = React.useState(false);
  const [editItem,        setEditItem]        = React.useState<RoleItem | null>(null);
  const [formSubmitting,  setFormSubmitting]  = React.useState(false);

  const pageRef       = useRef(1);
  const formResetRef  = useRef<(() => void) | null>(null);
  const ROLE_FORM_ID  = "role-mgmt-form";

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
        const res = await getData<RolesApiResponse>({
          endpoint: "roles", token: token, instance: "identity", params: buildParams(page),
        });
        const items = res.data.data.map(mapRole);
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch { showToastnew.error("Failed to fetch roles"); }
      finally   { append ? setLoadingMore(false) : setLoading(false); }
    },
    [apiKey, token, buildParams, dispatch],
  );

  React.useEffect(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleEdit   = useCallback((row: RoleItem) => { setEditItem(row); setShowModal(true); }, []);
  const handleDelete = useCallback(async (row: RoleItem) => {
    await deleteData({ endpoint: `roles/${row._id}`, token: token, instance: "identity" });
    showToastnew.success("Role deleted successfully");
    handleRefresh();
  }, [token, handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(ids.map((id) => deleteData({ endpoint: `roles/${id}`, token: token, instance: "identity" })));
    showToastnew.success(`${ids.length} role${ids.length > 1 ? "s" : ""} deleted`);
    handleRefresh();
  }, [token, handleRefresh]);

  const columns = useMemo<GridColumn<RoleItem>[]>(() => [
    { field: "role_name", headerName: "Role", minWidth: 200, sortable: true },
    {
      field: "role_access", headerName: "Action Set", minWidth: 300,
      renderCell: ({ row }) => {
        const list = row.role_access ?? [];
        return list.length === 0
          ? <span style={{ fontSize: 12, color: "var(--fi-muted)" }}>—</span>
          : <ActionSetBadge access={list} />;
      },
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
          placeholder="Search by role name"
          width={260}
        />

        <div style={{ flex: 1 }} />

        {perms.create && (
          <CleanButton
            variant="primary" size="sm"
            iconLeft={<Plus style={{ width: 13, height: 13 }} />}
            onClick={() => { setEditItem(null); setShowModal(true); }}
          >
            Create Role
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<RoleItem>
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
          bulkDeleteLabel="Delete selected roles — users with these roles may lose access"
          onEdit={perms.edit ? handleEdit : undefined}
          onDelete={perms.delete ? handleDelete : undefined}
          deleteConfirmTitle="Delete role?"
          deleteConfirmDescription="This will permanently remove the role. Users with this role may lose access."
        />
      </div>

      {/* ── Create / Edit modal ───────────────────────────────────────────────── */}
      <CleanModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); setFormSubmitting(false); }}
        title={editItem ? "Edit Role" : "Create Role"}
        subtitle="Set role name and module permissions"
        maxWidth={680}
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
              form={ROLE_FORM_ID}
              variant="primary"
              size="sm"
              loading={formSubmitting}
            >
              {editItem ? "Update Role" : "Create Role"}
            </CleanButton>
          </>
        }
      >
        <RoleForm
          formId={ROLE_FORM_ID}
          token={token}
          initialValues={editItem ?? undefined}
          onSuccess={() => { setShowModal(false); setEditItem(null); setFormSubmitting(false); handleRefresh(); }}
          onSubmittingChange={setFormSubmitting}
          onResetReady={(fn) => { formResetRef.current = fn; }}
        />
      </CleanModal>
    </div>
  );
};

export default RoleManagement;
