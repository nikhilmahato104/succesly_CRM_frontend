import React, { useCallback, useRef, useMemo } from "react";
import { selectAccessToken } from "../../store/slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { ListFilter, Plus, AlertTriangle } from "lucide-react";
import { CustomDatagrid, type GridColumn } from "../../atoms/CustomDatagrid";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, patchData, deleteData } from "../../services/crmServices";
import { fetchSWR, invalidatePrefix, cacheKey } from "../../lib/queryCache";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectApiKey, openApiKeyModal } from "../../store/slices/apiKeySlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import UserForm from "./UserForm";
import UserProfileCard, { type CardUser } from "../../atoms/UserProfileCard";
import {
  CleanButton, CleanSearchBar, CleanSelect, CleanModal, type SelectOption,
} from "../../atoms/my_clean_code_atoms";
import { OPEN_CREATE_USER_EVENT } from "../../organisms/MobileBottomBar";

const USER_FORM_ID = "user-mgmt-form";

// ── Types ──────────────────────────────────────────────────────────────────

interface UserApiItem {
  _id: string; username: string; email: string;
  mobile_no: string; role_id: string; is_active: boolean;
  profile_image_url?: string | null;
  role?: { _id: string; role_name: string };
}

interface UsersApiResponse {
  success: boolean; message: string;
  data: { data: UserApiItem[]; total: number; page: number; limit: number; totalPages: number };
}

type UserItem = {
  _id: string; name: string; email: string;
  mobile_no?: string; role_name?: string; role_id?: string; is_active: boolean;
  profile_image_url?: string | null;
};

type StatusState = { isOpen: boolean; id: string; name: string; is_active: boolean };

// ── Pure helpers ───────────────────────────────────────────────────────────

const mapUser = (u: UserApiItem): UserItem => ({
  _id: u._id, name: u.username, email: u.email,
  mobile_no: u.mobile_no, role_name: u.role?.role_name,
  role_id: u.role_id, is_active: u.is_active,
  profile_image_url: u.profile_image_url ?? null,
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Operation failed";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Avatar + Name cell ─────────────────────────────────────────────────────

interface UserNameCellProps {
  row: UserItem;
  onAvatarClick: (e: React.MouseEvent<HTMLDivElement>, row: UserItem) => void;
}

function UserNameCell({ row, onAvatarClick }: UserNameCellProps) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const url     = row.profile_image_url;
  const showImg = !!url && !imgFailed;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        onClick={(e) => { e.stopPropagation(); onAvatarClick(e, row); }}
        title="View profile"
        style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          overflow: "hidden", border: "1.5px solid var(--fi-border)",
          background: showImg ? "transparent" : "var(--sc-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transition: "box-shadow 150ms ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px var(--btn-primary-bg)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        {showImg
          ? <img src={url!} alt={row.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
          : <span style={{ fontSize: 9, fontWeight: 700, color: "var(--fi-muted)", lineHeight: 1 }}>{getInitials(row.name)}</span>
        }
      </div>
      <span style={{ fontSize: 13, color: "var(--dt-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {row.name}
      </span>
    </div>
  );
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

const STATUS_OPTIONS: SelectOption[] = [
  { value: "true",  label: "Active"   },
  { value: "false", label: "Inactive" },
];

const panelStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
  background: "var(--fi-bg-panel)", border: "1px solid var(--fi-border)",
  borderRadius: "var(--fi-radius)", boxShadow: "0 4px 20px rgba(0,0,0,0.10)", padding: 12,
};

const CLOSE_STATUS: StatusState = { isOpen: false, id: "", name: "", is_active: true };
const PER_PAGE = 25;

// ── Component ──────────────────────────────────────────────────────────────

const UserManagementList: React.FC = () => {
  const token = useSelector(selectAccessToken);
  const dispatch   = useDispatch();
  const apiKey     = useSelector(selectApiKey);
  const access     = useSelector((s: RootState) => selectAccessData(s));
  const perms      = (access?.["user_management"] ?? {}) as Record<string, boolean>;

  const [data,            setData]            = React.useState<UserItem[]>([]);
  const [search,          setSearch]          = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter,    setStatusFilter]    = React.useState("");
  const [total,           setTotal]           = React.useState(0);
  const [loading,         setLoading]         = React.useState(false);
  const [loadingMore,     setLoadingMore]     = React.useState(false);
  const [hasMore,         setHasMore]         = React.useState(false);
  const [showModal,       setShowModal]       = React.useState(false);
  const [editItem,        setEditItem]        = React.useState<UserItem | null>(null);
  const [statusModal,     setStatusModal]     = React.useState<StatusState>(CLOSE_STATUS);
  const [statusLoading,   setStatusLoading]   = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const [formSubmitting,  setFormSubmitting]  = React.useState(false);
  const [profileCard,     setProfileCard]     = React.useState<{ el: HTMLElement; user: CardUser } | null>(null);
  const [isMobile,        setIsMobile]        = React.useState(() => window.innerWidth < 1024);

  const pageRef        = useRef(1);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const formResetRef   = useRef<(() => void) | null>(null);

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
        const params = buildParams(page);
        const key    = cacheKey("users", params as Record<string, unknown>);

        // Page 1 (non-append) uses SWR: serve cached data instantly while
        // revalidating in background. Append / pagination always fetches fresh.
        const tok = token ?? undefined;
        const res = append || page > 1
          ? await getData<UsersApiResponse>({ endpoint: "users", token: tok, instance: "identity", params })
          : await fetchSWR<UsersApiResponse>(
              key,
              () => getData<UsersApiResponse>({ endpoint: "users", token: tok, instance: "identity", params }),
              30_000, 60_000,
              (fresh) => {
                const freshItems = fresh.data.data.map(mapUser);
                setData(freshItems);
                setTotal(fresh.data.total);
                setHasMore(1 < fresh.data.totalPages);
              },
            );

        const items = res.data.data.map(mapUser);
        setData((prev) => (append ? [...prev, ...items] : items));
        setTotal(res.data.total);
        setHasMore(page < res.data.totalPages);
        pageRef.current = page;
      } catch { showToastnew.error("Failed to fetch users"); }
      finally   { append ? setLoadingMore(false) : setLoading(false); if (!append) requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone())); }
    },
    [apiKey, token, buildParams, dispatch],
  );

  React.useEffect(() => { pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleLoadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const handleRefresh  = useCallback(() => { invalidatePrefix("users"); pageRef.current = 1; setData([]); fetchPage(1, false); }, [fetchPage]);

  const handleEdit   = useCallback((row: UserItem) => { setEditItem(row); setShowModal(true); }, []);
  const handleDelete = useCallback(async (row: UserItem) => {
    await deleteData({ endpoint: `users/${row._id}`, token: token, instance: "identity" });
    showToastnew.success("User deleted");
    handleRefresh();
  }, [token, handleRefresh]);

  const handleBulkDelete = useCallback(async (ids: (string | number)[]) => {
    await Promise.all(ids.map((id) => deleteData({ endpoint: `users/${id}`, token: token, instance: "identity" })));
    showToastnew.success(`${ids.length} user${ids.length > 1 ? "s" : ""} deleted`);
    handleRefresh();
  }, [token, handleRefresh]);

  const handleStatusToggle = async () => {
    if (!statusModal.id) return;
    setStatusLoading(true);
    try {
      await patchData({
        endpoint: `users/${statusModal.id}`, token: token, instance: "identity",
        data: { is_active: !statusModal.is_active },
      });
      showToastnew.success(statusModal.is_active ? "User deactivated" : "User activated");
      setStatusModal(CLOSE_STATUS);
      handleRefresh();
    } catch (err: unknown) { showToastnew.error(extractErrorMessage(err)); }
    finally { setStatusLoading(false); }
  };

  const closeCreateModal = () => { setShowModal(false); setEditItem(null); setFormSubmitting(false); };

  // Mobile FAB on /setting-config/user-management dispatches this event
  React.useEffect(() => {
    const handler = () => { setEditItem(null); setShowModal(true); };
    window.addEventListener(OPEN_CREATE_USER_EVENT, handler);
    return () => window.removeEventListener(OPEN_CREATE_USER_EVENT, handler);
  }, []);

  const activeFilterCount = statusFilter ? 1 : 0;

  const handleAvatarClick = useCallback((e: React.MouseEvent<HTMLDivElement>, row: UserItem) => {
    setProfileCard({
      el:   e.currentTarget,
      user: { name: row.name, email: row.email, role: row.role_name, profile_image_url: row.profile_image_url },
    });
  }, []);

  const columns = useMemo<GridColumn<UserItem>[]>(() => [
    {
      field: "name",
      headerName: "User Name",
      minWidth: 200,
      sortable: true,
      renderCell: ({ row }) => <UserNameCell row={row} onAvatarClick={handleAvatarClick} />,
    },
    { field: "email", headerName: "Email", minWidth: 220, sortable: true },
    {
      field: "role_name", headerName: "Role", minWidth: 150,
      renderCell: ({ value }) => (
        <span style={{ fontSize: 12, color: "var(--dt-dim)" }}>{(value as string) || "—"}</span>
      ),
    },
    {
      field: "is_active", headerName: "Status", minWidth: 120,
      renderCell: ({ row }) => (
        <button
          type="button"
          onClick={() => setStatusModal({ isOpen: true, id: row._id, name: row.name, is_active: row.is_active })}
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
          placeholder="Search by name or email"
          width={260}
        />

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
            Create User
          </CleanButton>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomDatagrid<UserItem>
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
          bulkDeleteLabel="Delete selected users — this cannot be undone"
          onEdit={perms.edit ? handleEdit : undefined}
          onDelete={perms.delete ? handleDelete : undefined}
          deleteConfirmTitle="Delete user?"
          deleteConfirmDescription="This action cannot be undone. The user account will be permanently removed."
        />
      </div>

      {/* ── Profile card popover ─────────────────────────────────────────────── */}
      <UserProfileCard
        user={profileCard?.user ?? null}
        anchorEl={profileCard?.el ?? null}
        onClose={() => setProfileCard(null)}
      />

      {/* ── Create / Edit modal ───────────────────────────────────────────────── */}
      <CleanModal
        isOpen={showModal}
        onClose={closeCreateModal}
        title={editItem ? "Edit User" : "Create User"}
        subtitle={editItem ? "Update user details" : "Add a new user account"}
        maxWidth={520}
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
              form={USER_FORM_ID}
              variant="primary"
              size="sm"
              loading={formSubmitting}
            >
              {editItem ? "Update User" : "Create User"}
            </CleanButton>
          </>
        }
      >
        <UserForm
          formId={USER_FORM_ID}
          token={token}
          initialValues={editItem ?? undefined}
          onSuccess={() => { closeCreateModal(); handleRefresh(); }}
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
              {statusModal.is_active ? "Deactivate" : "Activate"} User
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

export default UserManagementList;
