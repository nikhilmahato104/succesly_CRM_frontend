import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardApi, BoardSummary, Pagination } from '../../services/boardApi';
import './BoardsPage.css';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'Just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── Card context menu ────────────────────────────────────────────────────── */
interface MenuProps {
  board:       BoardSummary;
  onRename:    () => void;
  onDuplicate: () => void;
  onDelete:    () => void;
  onClose:     () => void;
}

const CardMenu: React.FC<MenuProps> = ({ onRename, onDuplicate, onDelete, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  return (
    <div ref={ref} className="bh-dropdown">
      <button className="bh-dd-item" onClick={(e) => { e.stopPropagation(); onRename(); }}>✏️ Rename</button>
      <button className="bh-dd-item" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>📋 Duplicate</button>
      <div className="bh-dd-sep" />
      <button className="bh-dd-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑 Delete</button>
    </div>
  );
};

/* ── Board Card ───────────────────────────────────────────────────────────── */
interface CardProps {
  board:       BoardSummary;
  onOpen:      () => void;
  onRename:    (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete:    (id: string) => void;
}

const BoardCard: React.FC<CardProps> = ({ board, onOpen, onRename, onDuplicate, onDelete }) => {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [renaming,   setRenaming]   = useState(false);
  const [newName,    setNewName]    = useState(board.name);
  const [isSaving,   setIsSaving]   = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName === board.name) { setRenaming(false); return; }
    setIsSaving(true);
    try { await onRename(board._id, newName.trim()); }
    finally { setIsSaving(false); setRenaming(false); }
  };

  return (
    <>
      <div className="bh-card" onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onOpen()}>
        {/* Thumbnail */}
        <div className="bh-card-thumb">
          {board.thumbnail
            ? <img className="bh-card-thumb-img" src={board.thumbnail} alt={board.name} />
            : (
              <div className="bh-card-thumb-placeholder">
                <span className="bh-card-thumb-icon">🗂</span>
                <span className="bh-card-thumb-count">{board.objectCount} objects</span>
              </div>
            )}

          {/* Three-dot menu */}
          <div className="bh-card-menu" onClick={e => e.stopPropagation()}>
            <button className="bh-card-menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Board options">⋯</button>
            {menuOpen && (
              <CardMenu
                board={board}
                onRename={() => { setMenuOpen(false); setRenaming(true); setNewName(board.name); }}
                onDuplicate={() => { setMenuOpen(false); onDuplicate(board._id); }}
                onDelete={() => { setMenuOpen(false); onDelete(board._id); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bh-card-info">
          <div className="bh-card-name">{board.name}</div>
          <div className="bh-card-meta">
            <span className="bh-card-date">Edited {timeAgo(board.updatedAt)}</span>
            <span className="bh-card-version">v{board.version}</span>
          </div>
        </div>
      </div>

      {/* Rename modal */}
      {renaming && (
        <div className="bh-modal-overlay" onClick={() => setRenaming(false)}>
          <div className="bh-modal" onClick={e => e.stopPropagation()}>
            <div className="bh-modal-title">Rename Board</div>
            <input
              className="bh-modal-input"
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              autoFocus
              maxLength={100}
            />
            <div className="bh-modal-actions">
              <button className="bh-modal-cancel" onClick={() => setRenaming(false)}>Cancel</button>
              <button className="bh-modal-confirm" onClick={handleRename} disabled={isSaving || !newName.trim()}>
                {isSaving ? 'Saving…' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Boards Page ──────────────────────────────────────────────────────────── */
const BoardsPage: React.FC = () => {
  const navigate = useNavigate();

  const [boards,     setBoards]     = useState<BoardSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState<'updatedAt' | 'createdAt' | 'name'>('updatedAt');
  const [order,      setOrder]      = useState<'asc' | 'desc'>('desc');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [creating,   setCreating]   = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch ──────────────────────────────────────────────────────────── */
  const fetchBoards = useCallback(async (p = page, s = search) => {
    setLoading(true); setError(null);
    try {
      const res = await boardApi.getAll({ page: p, limit: 20, search: s || undefined, sort, order });
      setBoards(res.boards);
      setPagination(res.pagination);
    } catch {
      setError('Failed to load boards. Check your API connection.');
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, order]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  /* ── Debounced search ───────────────────────────────────────────────── */
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchBoards(1, val), 350);
  };

  /* ── Create board ───────────────────────────────────────────────────── */
  const handleCreate = async () => {
    const name = `Untitled Board ${new Date().toLocaleDateString()}`;
    setCreating(true);
    try {
      const board = await boardApi.create(name);
      navigate(`/board/${board._id}`);
    } catch {
      setError('Failed to create board.');
    } finally {
      setCreating(false);
    }
  };

  /* ── Rename ─────────────────────────────────────────────────────────── */
  const handleRename = async (id: string, name: string) => {
    await boardApi.rename(id, name);
    setBoards(prev => prev.map(b => b._id === id ? { ...b, name } : b));
  };

  /* ── Duplicate ──────────────────────────────────────────────────────── */
  const handleDuplicate = async (id: string) => {
    try {
      const dup = await boardApi.duplicate(id);
      navigate(`/board/${dup.id}`);
    } catch {
      setError('Failed to duplicate board.');
    }
  };

  /* ── Delete ─────────────────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this board? This cannot be undone.')) return;
    try {
      await boardApi.remove(id);
      setBoards(prev => prev.filter(b => b._id !== id));
    } catch {
      setError('Failed to delete board.');
    }
  };

  /* ── Sort toggle ────────────────────────────────────────────────────── */
  const toggleSort = (field: typeof sort) => {
    if (sort === field) setOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSort(field); setOrder('desc'); }
    setPage(1);
  };

  return (
    <div className="bh-root">
      {/* Top bar */}
      <div className="bh-topbar">
        <div className="bh-logo">🗂</div>
        <span className="bh-title">My Boards</span>
        <div className="bh-spacer" />

        {/* Search */}
        <div className="bh-search-wrap">
          <span className="bh-search-icon">🔍</span>
          <input
            className="bh-search-input"
            type="text"
            placeholder="Search boards…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* New board */}
        <button className="bh-new-btn" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : '+ New Board'}
        </button>
      </div>

      {/* Body */}
      <div className="bh-body">
        {/* Section header + sort */}
        <div className="bh-sort-row">
          <span className="bh-sort-label">Sort by:</span>
          {(['updatedAt', 'createdAt', 'name'] as const).map(f => (
            <button
              key={f}
              className={`bh-sort-btn${sort === f ? ' active' : ''}`}
              onClick={() => toggleSort(f)}
            >
              {f === 'updatedAt' ? 'Last edited' : f === 'createdAt' ? 'Created' : 'Name'}
              {sort === f && <span> {order === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
          {pagination && (
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#94a3b8', fontWeight: 500 }}>
              {pagination.total} board{pagination.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Error */}
        {error && <div className="bh-error">⚠️ {error}</div>}

        {/* Loading */}
        {loading && (
          <div className="bh-loading">
            <div className="bh-spinner" />
            <span>Loading boards…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && boards.length === 0 && !error && (
          <div className="bh-empty">
            <span className="bh-empty-icon">🗂</span>
            <div className="bh-empty-title">
              {search ? 'No boards found' : 'No boards yet'}
            </div>
            <div className="bh-empty-desc">
              {search
                ? `No boards match "${search}". Try a different search.`
                : 'Create your first board to start planning and drawing.'}
            </div>
            {!search && (
              <button className="bh-new-btn" onClick={handleCreate} style={{ marginTop: 8 }}>
                + Create Board
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && boards.length > 0 && (
          <div className="bh-grid">
            {boards.map(board => (
              <BoardCard
                key={board._id}
                board={board}
                onOpen={() => navigate(`/board/${board._id}`)}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bh-pagination">
            <button
              className="bh-page-btn"
              disabled={!pagination.hasPrev}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            <span className="bh-page-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="bh-page-btn"
              disabled={!pagination.hasNext}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardsPage;
