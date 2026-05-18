// =============================================================================
// CustomDatagrid — enterprise-grade data table component
//
// Color system: all colours come from CSS custom properties defined in
// index.css under the "DataTable design tokens" block.
//
// Features:
//   • Scroll pagination (auto-fills viewport, loads next page when near bottom)
//   • Traditional page-number pagination
//   • Column sort / resize / drag-reorder
//   • Cell inline editing
//   • Column visibility panel (Fields)
//   • Skeleton loading state (table + footer exact replica)
//   • Selectable rows with bulk-delete bar (BulkActionBar atom)
//   • Per-row action column: View (Eye), Edit (Pencil), Delete (ConfirmDeleteModal)
//   • Action column is always the last user-visible column — cannot be reordered
//   • All new features are prop-based; omit any to disable that feature
//   • Full dark-mode via .dark class on <html>
// =============================================================================

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleFadingPlus,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { BulkActionBar }     from './my_clean_code_atoms/BulkActionBar'
import { ConfirmDeleteModal } from './my_clean_code_atoms/ConfirmDeleteModal'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridColumn<T = Record<string, unknown>> {
  field: string
  headerName: string
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  editable?: boolean
  cellStyle?: { fontSize?: string; fontWeight?: string; color?: string }
  renderCell?: (params: { row: T; value: unknown }) => React.ReactNode
  renderEditCell?: (params: EditCellParams<T>) => React.ReactNode
  onHeaderClick?: (e: React.MouseEvent) => void
}

interface EditCellParams<T> {
  id: string | number
  row: T
  value: unknown
  field: string
  api: {
    setEditCellValue: (p: { value: unknown }) => void
    getRow: (id: string | number) => T | undefined
  }
}

export interface CustomDatagridProps<T = Record<string, unknown>> {
  rows?: T[]
  columns?: GridColumn<T>[]
  CustomNoRowsOverlay?: React.ComponentType
  getRowId?: (row: T) => string | number
  onCellClick?: (
    params: { id: string | number; field: string; value: unknown; originalValue?: unknown },
    e: Event,
  ) => void
  onRowClick?: (row: T) => void
  isLoading?: boolean
  totalItems?: number
  currentPage?: number
  itemsPerPage?: number
  onPageChange?: (page: number) => void
  onItemsPerPageChange?: (perPage: number) => void
  isShowResult?: boolean
  enableColumnResize?: boolean
  minColumnWidth?: number
  onColumnWidthChange?: (field: string, width: number) => void

  // Scroll pagination mode — rows accumulate; next page loads near bottom
  onScrollPagination?: boolean
  loadMoreThreshold?: number
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  onRefresh?: () => void
  onColumnReorder?: (order: string[]) => void

  // ── Selectable rows ──────────────────────────────────────────────────────
  selectable?: boolean
  onBulkDelete?: (ids: (string | number)[]) => Promise<void> | void
  bulkDeleteLabel?: string      // override default warning text

  // ── Per-row action column (always last) ──────────────────────────────────
  onView?:   (row: T) => void
  onEdit?:   (row: T) => void
  onDelete?: (row: T) => Promise<void> | void
  deleteConfirmTitle?:       string
  deleteConfirmDescription?: string
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SELECT_COL_WIDTH = 40
const ACTION_COL_WIDTH = 96

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const DEFAULT_ROW_ID = (row: Record<string, unknown>): string | number =>
  (row.id ?? row._id ?? '') as string | number

function getColWidth(col: GridColumn, widths: Record<string, number>): number {
  return widths[col.field] ?? col.minWidth ?? 150
}

function getClientX(e: MouseEvent | TouchEvent): number {
  return (e as MouseEvent).clientX ?? (e as TouchEvent).touches?.[0]?.clientX ?? 0
}

// System columns always go last; config col is added internally
function buildColumnOrder(cols: GridColumn[]): string[] {
  const core = cols
    .filter((c) => c.field !== 'column_config' && c.field !== 'actions')
    .map((c) => c.field)
  const hasActions = cols.some((c) => c.field === 'actions')
  const hasConfig  = cols.some((c) => c.field === 'column_config')
  return [
    ...core,
    ...(hasActions ? ['actions'] : []),
    ...(hasConfig  ? ['column_config'] : []),
  ]
}

function sortItems<T>(items: T[], key: string, dir: 'ascending' | 'descending'): T[] {
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    if (av === bv) return 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((av as any) < (bv as any) ? -1 : 1) * (dir === 'ascending' ? 1 : -1)
  })
}

function paginateItems<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage)
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

// Scrollbar micro-style — picks up --dt-scrollbar tokens from index.css
const SCROLL_CSS = `
  .cdg-scroll::-webkit-scrollbar        { width: 5px; height: 5px }
  .cdg-scroll::-webkit-scrollbar-track  { background: transparent }
  .cdg-scroll::-webkit-scrollbar-thumb  { background: var(--dt-scrollbar); border-radius: 3px }
  .cdg-scroll::-webkit-scrollbar-thumb:hover { background: var(--dt-scrollbar-hover) }
  .cdg-scroll::-webkit-scrollbar-corner { background: transparent }
`

// ─── CheckboxCell ─────────────────────────────────────────────────────────────

interface CheckboxCellProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClick?: (e: React.MouseEvent) => void
  title?: string
}

const CheckboxCell: React.FC<CheckboxCellProps> = ({
  checked, indeterminate = false, onChange, onClick, title,
}) => {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      title={title}
      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--dt-accent)', flexShrink: 0 }}
    />
  )
}

// ─── ActionIconBtn ────────────────────────────────────────────────────────────

interface ActionIconBtnProps {
  icon:        React.ReactNode
  title:       string
  onClick:     (e: React.MouseEvent) => void
  color?:      string
  hoverColor?: string
  hoverBg?:   string
}

const ActionIconBtn: React.FC<ActionIconBtnProps> = ({
  icon, title, onClick,
  color      = 'var(--dt-dim)',
  hoverColor = 'var(--dt-text)',
  hoverBg    = 'var(--dt-hover)',
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          26,
      height:         26,
      borderRadius:   5,
      border:         'none',
      background:     'transparent',
      cursor:         'pointer',
      color,
      transition:     'background 120ms ease, color 120ms ease',
      flexShrink:     0,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = hoverBg
      e.currentTarget.style.color = hoverColor
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = color
    }}
  >
    {icon}
  </button>
)

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  field: string
  width: number
  enabled: boolean
  active: boolean
  onStart: (e: React.MouseEvent | React.TouchEvent, field: string, width: number) => void
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ field, width, enabled, active, onStart }) => {
  if (!enabled) return null
  return (
    <div
      style={{
        position: 'absolute', right: 0, top: 0, height: '100%', width: 3,
        cursor: 'col-resize', zIndex: 20, transform: 'translateX(50%)',
        background: active ? 'var(--dt-border-strong)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--dt-border)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      onMouseDown={(e) => onStart(e, field, width)}
      onTouchStart={(e) => onStart(e, field, width)}
    />
  )
}

// ─── SortButton ───────────────────────────────────────────────────────────────

interface SortButtonProps {
  field: string
  sortConfig: { key: string | null; direction: 'ascending' | 'descending' }
  onSort: (field: string) => void
}

const SortButton: React.FC<SortButtonProps> = ({ field, sortConfig, onSort }) => {
  const isActive = sortConfig.key === field
  const Icon = isActive && sortConfig.direction === 'descending' ? ChevronDown : ChevronUp
  return (
    <button type="button" onClick={() => onSort(field)} className="ml-0.5 flex items-center shrink-0">
      <Icon size={11} style={{ color: isActive ? 'var(--dt-text)' : 'var(--dt-muted)' }} />
    </button>
  )
}

// ─── ConfigColumnHeader ───────────────────────────────────────────────────────

const ConfigColumnHeader: React.FC<{ column: GridColumn; opacity?: number }> = ({
  column, opacity = 1,
}) => (
  <th
    style={{
      width: 50, minWidth: 50, maxWidth: 50, position: 'sticky', right: 0, zIndex: 60,
      opacity, background: 'var(--dt-header)', borderBottom: '1px solid var(--dt-border)',
      padding: '0 8px',
    }}
  >
    <div
      className="flex justify-center items-center h-full cursor-pointer"
      onClick={(e) => { e.stopPropagation(); column.onHeaderClick?.(e) }}
      title="Configure columns"
    >
      <CircleFadingPlus size={16} style={{ color: 'var(--dt-muted)' }} />
    </div>
  </th>
)

// ─── HeaderCell ───────────────────────────────────────────────────────────────

interface HeaderCellProps<T> {
  column: GridColumn<T>
  width: number
  minColumnWidth: number
  sortConfig: { key: string | null; direction: 'ascending' | 'descending' }
  onSort: (field: string) => void
  isDragging: boolean
  isDragOver: boolean
  resizingField: string | null
  enableResize: boolean
  onDragStart: (e: React.DragEvent, field: string) => void
  onDragOver: (e: React.DragEvent, field: string) => void
  onDrop: (e: React.DragEvent, field: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragEnd: () => void
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, field: string, width: number) => void
}

function HeaderCell<T>({
  column, width, minColumnWidth, sortConfig, onSort,
  isDragging, isDragOver, resizingField, enableResize,
  onDragStart, onDragOver, onDrop, onDragLeave, onDragEnd, onResizeStart,
}: HeaderCellProps<T>) {
  if (column.field === 'column_config') {
    return <ConfigColumnHeader column={column as GridColumn} />
  }

  const draggable = column.field !== 'actions'
  const bg = isDragging ? 'opacity-40' : ''

  return (
    <th
      draggable={draggable}
      onDragStart={(e) => draggable && onDragStart(e, column.field)}
      onDragOver={(e) => onDragOver(e, column.field)}
      onDrop={(e) => onDrop(e, column.field)}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      className={`relative overflow-hidden group cursor-grab active:cursor-grabbing ${bg}`}
      style={{
        width, minWidth: minColumnWidth, maxWidth: column.maxWidth ?? width,
        padding: '0 16px', height: 37,
        background: isDragOver ? 'var(--dt-header-hover)' : 'var(--dt-header)',
        borderBottom: '1px solid var(--dt-border)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.background = 'var(--dt-header-hover)' }}
      onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.background = 'var(--dt-header)' }}
    >
      <div className="flex items-center gap-1">
        <span
          className="text-xs font-semibold truncate select-none"
          style={{ color: 'var(--dt-dim)' }}
        >
          {column.headerName}
        </span>
        {column.sortable && (
          <SortButton field={column.field} sortConfig={sortConfig} onSort={onSort} />
        )}
      </div>
      <ResizeHandle
        field={column.field}
        width={width}
        enabled={enableResize}
        active={resizingField === column.field}
        onStart={onResizeStart}
      />
    </th>
  )
}

// ─── CellContent ──────────────────────────────────────────────────────────────

interface CellContentProps<T> {
  row: T
  column: GridColumn<T>
  rowId: string | number
  cellValue: unknown
  isEditing: boolean
  onValueChange: (rowId: string | number, field: string, value: unknown) => void
  getRow: (id: string | number) => T | undefined
}

function CellContent<T>({
  row, column, rowId, cellValue, isEditing, onValueChange, getRow,
}: CellContentProps<T>) {
  const style = {
    fontSize: column.cellStyle?.fontSize ?? '12px',
    fontWeight: column.cellStyle?.fontWeight,
    color: column.cellStyle?.color,
  }

  if (isEditing && column.renderEditCell) {
    return (
      <>
        {column.renderEditCell({
          id: rowId, row, value: cellValue, field: column.field,
          api: {
            setEditCellValue: ({ value }) => onValueChange(rowId, column.field, value),
            getRow,
          },
        })}
      </>
    )
  }

  if (column.renderCell) {
    return (
      <div className="truncate whitespace-nowrap" style={style}>
        {column.renderCell({ row, value: cellValue })}
      </div>
    )
  }

  return (
    <div className="truncate whitespace-nowrap" style={style}>
      {cellValue != null ? String(cellValue) : ''}
    </div>
  )
}

// ─── DataCell ─────────────────────────────────────────────────────────────────

interface DataCellProps<T> {
  row: T
  column: GridColumn<T>
  rowId: string | number
  cellValue: unknown
  isEditing: boolean
  isActiveBorder: boolean
  minColumnWidth: number
  width: number
  onEdit: (rowId: string | number, field: string, value: unknown) => void
  onSave: (rowId: string | number, field: string, orig: unknown) => void
  onValueChange: (rowId: string | number, field: string, value: unknown) => void
  getRow: (id: string | number) => T | undefined
}

function DataCell<T>({
  row, column, rowId, cellValue, isEditing, isActiveBorder,
  minColumnWidth, width, onEdit, onSave, onValueChange, getRow,
}: DataCellProps<T>) {
  if (column.field === 'column_config') {
    return (
      <td
        style={{
          width: 50, minWidth: 50, maxWidth: 50, position: 'sticky', right: 0,
          zIndex: 30, padding: 0, background: 'var(--dt-bg)',
        }}
      />
    )
  }

  return (
    <td
      className={`align-middle text-xs ${column.editable ? 'cursor-pointer' : ''}`}
      style={{
        width, minWidth: minColumnWidth, maxWidth: column.maxWidth ?? width,
        height: 32, padding: 0, color: 'var(--dt-text)',
        outline: isActiveBorder ? '1px solid var(--dt-border-strong)' : 'none',
        outlineOffset: '-1px',
      }}
      onClick={() => column.editable && onEdit(rowId, column.field, cellValue)}
      onBlur={() => isEditing && onSave(rowId, column.field, cellValue)}
    >
      <div className="relative h-8 flex items-center px-4">
        <CellContent
          row={row} column={column} rowId={rowId} cellValue={cellValue}
          isEditing={isEditing} onValueChange={onValueChange} getRow={getRow}
        />
      </div>
    </td>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonHeaderCell: React.FC<{ col: GridColumn; width: number; min: number }> = ({
  col, width, min,
}) => {
  if (col.field === 'column_config') {
    return (
      <th style={{ width: 50, minWidth: 50, maxWidth: 50, position: 'sticky', right: 0, zIndex: 60, background: 'var(--dt-header)', padding: '0 8px', borderBottom: '1px solid var(--dt-border)' }}>
        <CircleFadingPlus size={16} style={{ color: 'var(--dt-muted)', margin: '0 auto', opacity: 0.4 }} />
      </th>
    )
  }
  return (
    <th
      className="text-left text-xs"
      style={{ width, minWidth: min, maxWidth: col.maxWidth ?? width, padding: '0 16px', height: 37, background: 'var(--dt-header)', borderBottom: '1px solid var(--dt-border)', color: 'var(--dt-dim)', fontWeight: 600 }}
    >
      {col.headerName}
    </th>
  )
}

const SkeletonBodyCell: React.FC<{ col: GridColumn; width: number; min: number }> = ({
  col, width, min,
}) => {
  if (col.field === 'column_config') {
    return (
      <td style={{ width: 50, minWidth: 50, maxWidth: 50, position: 'sticky', right: 0, zIndex: 30, padding: 0, height: 32, background: 'var(--dt-bg)' }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
          <CircleFadingPlus size={16} style={{ color: 'var(--dt-dim)' }} />
        </div>
      </td>
    )
  }
  return (
    <td style={{ width, minWidth: min, maxWidth: col.maxWidth ?? width, height: 32, padding: 0, background: 'var(--dt-bg)' }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <div
          style={{
            height: 14, borderRadius: 3, width: '100%',
            background: `linear-gradient(90deg, var(--dt-skeleton-from), var(--dt-skeleton-to), var(--dt-skeleton-from))`,
            backgroundSize: '200% 100%',
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </td>
  )
}

// Skeleton shimmer for the checkbox column
const SkeletonSelectHeader: React.FC = () => (
  <th style={{ width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, padding: '0 13px', height: 37, background: 'var(--dt-header)', borderBottom: '1px solid var(--dt-border)' }}>
    <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--dt-skeleton-from)', opacity: 0.5 }} />
  </th>
)
const SkeletonSelectCell: React.FC = () => (
  <td style={{ width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, padding: '0 13px', height: 32, background: 'var(--dt-bg)' }}>
    <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--dt-skeleton-from)', opacity: 0.35 }} />
  </td>
)

// Skeleton shimmer for the actions column
const SkeletonActionsHeader: React.FC<{ count: number }> = ({ count }) => (
  <th style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, padding: '0 8px', height: 37, background: 'var(--dt-header)', borderBottom: '1px solid var(--dt-border)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--dt-skeleton-from)', opacity: 0.35 }} />
      ))}
    </div>
  </th>
)
const SkeletonActionsCell: React.FC<{ count: number }> = ({ count }) => (
  <td style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, padding: '0 8px', height: 32, background: 'var(--dt-bg)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--dt-skeleton-from)', opacity: 0.25 }} />
      ))}
    </div>
  </td>
)

const TableSkeleton: React.FC<{
  columns: GridColumn[]
  columnWidths: Record<string, number>
  minColumnWidth: number
  hasSelect?: boolean
  actionsCount?: number
}> = ({ columns, columnWidths, minColumnWidth, hasSelect = false, actionsCount = 0 }) => {
  const rows = Array.from({ length: 25 }, (_, i) => i)
  return (
    <div
      className="overflow-x-auto overflow-y-auto cdg-scroll"
      style={{ flex: '1 1 0', height: 0, minHeight: 300, background: 'var(--dt-bg)', scrollbarWidth: 'thin', scrollbarColor: 'var(--dt-scrollbar) transparent' }}
    >
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', background: 'var(--dt-bg)' }}>
        <thead className="sticky top-0 z-10" style={{ background: 'var(--dt-header)' }}>
          <tr>
            {hasSelect && <SkeletonSelectHeader />}
            {columns.map((col) => (
              <SkeletonHeaderCell key={col.field} col={col} width={getColWidth(col, columnWidths)} min={minColumnWidth} />
            ))}
            {actionsCount > 0 && <SkeletonActionsHeader count={actionsCount} />}
            {/* Settings icon column */}
            <th style={{ width: 36, minWidth: 36, position: 'sticky', right: 0, zIndex: 60, background: 'var(--dt-header)', borderLeft: '1px solid var(--dt-border)', borderBottom: '1px solid var(--dt-border)' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i} style={{ opacity: Math.max(0.1, 0.9 - i * 0.035), borderBottom: '1px solid var(--dt-border)' }}>
              {hasSelect && <SkeletonSelectCell />}
              {columns.map((col) => (
                <SkeletonBodyCell key={col.field} col={col} width={getColWidth(col, columnWidths)} min={minColumnWidth} />
              ))}
              {actionsCount > 0 && <SkeletonActionsCell count={actionsCount} />}
              <td style={{ width: 36, minWidth: 36, position: 'sticky', right: 0, zIndex: 30, background: 'var(--dt-bg)', borderLeft: '1px solid var(--dt-border)' }} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function buildPageNumbers(current: number, total: number, max: number): number[] {
  const start = Math.max(1, current - Math.floor(max / 2))
  const end = Math.min(total, start + max - 1)
  const adjStart = Math.max(1, end - max + 1)
  return Array.from({ length: end - adjStart + 1 }, (_, i) => adjStart + i)
}

const NavBtn: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode }> = ({
  onClick, disabled, children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center justify-center p-1.5 rounded transition-colors"
    style={{
      border: '1px solid var(--dt-border)',
      background: 'var(--dt-bg)',
      color: disabled ? 'var(--dt-muted)' : 'var(--dt-dim)',
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    {children}
  </button>
)

const TablePagination: React.FC<{
  currentPage: number; totalPages: number; startItem: number; endItem: number
  totalCount: number; itemsPerPage: number; isLoading: boolean
  isShowResult: boolean; isMobile: boolean
  onPageChange: (page: number) => void; onItemsPerPageChange: (n: number) => void
}> = ({
  currentPage, totalPages, startItem, endItem, totalCount,
  itemsPerPage, isLoading, isShowResult, isMobile,
  onPageChange, onItemsPerPageChange,
}) => {
  const pages  = buildPageNumbers(currentPage, totalPages, isMobile ? 3 : 5)
  const atFirst = currentPage === 1 || isLoading
  const atLast  = currentPage === totalPages || totalPages === 0 || isLoading
  const lastPage = pages[pages.length - 1]

  return (
    <div
      className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-2 shrink-0"
      style={{ borderTop: '1px solid var(--dt-border)', background: 'var(--dt-bg)' }}
    >
      {isShowResult && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--dt-dim)' }}>Show</span>
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={isLoading}
              className="appearance-none rounded px-2 py-1 pr-6 text-xs outline-none"
              style={{ border: '1px solid var(--dt-border)', background: 'var(--dt-bg)', color: 'var(--dt-text)' }}
            >
              {PER_PAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--dt-dim)' }} />
          </div>
        </div>
      )}

      <span className="text-xs" style={{ color: 'var(--dt-dim)' }}>
        {isLoading
          ? <span style={{ display: 'inline-block', width: 80, height: 12, borderRadius: 3, background: 'var(--dt-skeleton-from)' }} />
          : <><b style={{ color: 'var(--dt-text)' }}>{startItem}</b> – <b style={{ color: 'var(--dt-text)' }}>{endItem}</b> of <b style={{ color: 'var(--dt-text)' }}>{totalCount}</b></>
        }
      </span>

      <div className="flex items-center gap-1">
        <NavBtn onClick={() => onPageChange(1)} disabled={atFirst}><ChevronsLeft size={14} /></NavBtn>
        <NavBtn onClick={() => onPageChange(currentPage - 1)} disabled={atFirst}><ChevronLeft size={14} /></NavBtn>
        {isLoading
          ? (
            // Skeleton page buttons — exact width replica
            Array.from({ length: isMobile ? 3 : 5 }).map((_, i) => (
              <div
                key={i}
                style={{ width: 30, height: 26, borderRadius: 4, background: 'var(--dt-skeleton-from)', opacity: i === 0 ? 0.6 : 0.35 }}
              />
            ))
          )
          : pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded text-xs font-medium min-w-[30px] transition-colors"
              style={
                currentPage === p
                  ? { background: 'var(--dt-accent)', border: '1px solid var(--dt-accent)', color: 'var(--dt-bg)' }
                  : { background: 'var(--dt-bg)', border: '1px solid var(--dt-border)', color: 'var(--dt-text)' }
              }
            >
              {p}
            </button>
          ))
        }
        {!isLoading && lastPage !== undefined && lastPage < totalPages && (
          <span className="px-1 text-xs" style={{ color: 'var(--dt-muted)' }}>…</span>
        )}
        <NavBtn onClick={() => onPageChange(currentPage + 1)} disabled={atLast}><ChevronRight size={14} /></NavBtn>
        <NavBtn onClick={() => onPageChange(totalPages)} disabled={atLast}><ChevronsRight size={14} /></NavBtn>
      </div>
    </div>
  )
}

// ─── ScrollCounter ────────────────────────────────────────────────────────────

const ScrollCounter: React.FC<{
  count: number
  total: number
  onRefresh?: () => void
  isLoading?: boolean
}> = ({ count, total, onRefresh, isLoading = false }) => (
  <div
    className="flex items-center justify-center gap-2 py-2 shrink-0"
    style={{ borderTop: '1px solid var(--dt-border)', background: 'var(--dt-bg)' }}
  >
    {isLoading ? (
      <span style={{ display: 'inline-block', width: 70, height: 12, borderRadius: 3, background: 'var(--dt-skeleton-from)' }} />
    ) : (
      <>
        <span className="text-xs" style={{ color: 'var(--dt-dim)' }}>
          {count} of {total}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{ color: 'var(--dt-muted)', display: 'flex', alignItems: 'center' }}
            title="Refresh"
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--dt-dim)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--dt-muted)')}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </>
    )}
  </div>
)

// ─── ColumnConfigPanel ────────────────────────────────────────────────────────

const ColumnConfigPanel: React.FC<{
  allColumns: GridColumn[]
  hiddenColumns: Set<string>
  onToggle: (field: string) => void
  onClose: () => void
}> = ({ allColumns, hiddenColumns, onToggle, onClose }) => {
  const shown  = allColumns.filter((c) => !hiddenColumns.has(c.field))
  const hidden = allColumns.filter((c) =>  hiddenColumns.has(c.field))

  return (
    <div
      className="absolute top-0 right-0 h-full flex flex-col z-50"
      style={{
        width: 220,
        background: 'var(--sb-bg)',
        borderLeft: '1px solid var(--sb-border)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px 11px',
          borderBottom: '1px solid var(--sb-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sb-text-active)', letterSpacing: '0.01em' }}>Fields</span>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 5, border: 'none',
            background: 'transparent', cursor: 'pointer', color: 'var(--sb-text-dim)',
            transition: 'background 140ms ease, color 140ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text-active)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-dim)'; }}
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cdg-scroll" style={{ padding: '6px 8px' }}>
        {shown.length > 0 && (
          <>
            <div style={{ padding: '6px 8px 3px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--sb-text-dim)' }}>
              Shown
            </div>
            {shown.map((col) => (
              <button
                key={col.field}
                onClick={() => onToggle(col.field)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '6px 8px', borderRadius: 6, fontSize: 13, fontWeight: 400,
                  color: 'var(--sb-text)', background: 'transparent', border: 'none',
                  cursor: 'pointer', transition: 'background 140ms ease',
                  boxSizing: 'border-box', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sb-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Eye size={13} style={{ color: '#4caf50', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.headerName}</span>
              </button>
            ))}
          </>
        )}
        {hidden.length > 0 && (
          <>
            <div style={{ padding: '10px 8px 3px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--sb-text-dim)' }}>
              Hidden
            </div>
            {hidden.map((col) => (
              <button
                key={col.field}
                onClick={() => onToggle(col.field)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '6px 8px', borderRadius: 6, fontSize: 13, fontWeight: 400,
                  color: 'var(--sb-text-dim)', background: 'transparent', border: 'none',
                  cursor: 'pointer', transition: 'background 140ms ease',
                  boxSizing: 'border-box', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sb-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <EyeOff size={13} style={{ flexShrink: 0, color: 'var(--sb-text-dim)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.headerName}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768,
  )
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

function useColumnResize(
  columns: GridColumn[],
  min: number,
  onWidthChange?: (field: string, width: number) => void,
) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const startRef = useRef({ x: 0, width: 0 })

  useEffect(() => {
    const init: Record<string, number> = {}
    columns.forEach((c) => { init[c.field] = c.minWidth ?? 150 })
    setColumnWidths(init)
  }, [columns])

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!resizingColumn) return
    const col = columns.find((c) => c.field === resizingColumn)
    const newWidth = Math.min(
      col?.maxWidth ?? Infinity,
      Math.max(col?.minWidth ?? min, startRef.current.width + getClientX(e) - startRef.current.x),
    )
    setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }))
  }, [resizingColumn, min, columns])

  const handleResizeEnd = useCallback(() => {
    if (resizingColumn && onWidthChange) {
      setColumnWidths((prev) => { onWidthChange(resizingColumn, prev[resizingColumn]); return prev })
    }
    setIsResizing(false)
    setResizingColumn(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [resizingColumn, onWidthChange])

  useEffect(() => {
    if (!isResizing) return
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
    document.addEventListener('touchmove', handleResizeMove)
    document.addEventListener('touchend', handleResizeEnd)
    return () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.removeEventListener('touchmove', handleResizeMove)
      document.removeEventListener('touchend', handleResizeEnd)
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  const handleResizeStart = useCallback((
    e: React.MouseEvent | React.TouchEvent, field: string, width: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const clientX = (e as React.MouseEvent).clientX ?? (e as React.TouchEvent).touches?.[0]?.clientX ?? 0
    setIsResizing(true)
    setResizingColumn(field)
    startRef.current = { x: clientX, width }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  return { columnWidths, resizingColumn, handleResizeStart }
}

function useColumnDragDrop(
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>,
  isResizing: boolean,
  onColumnReorder?: (order: string[]) => void,
) {
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [dragOverField, setDragOverField] = useState<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, field: string) => {
    if (isResizing) { e.preventDefault(); return }
    setDraggedField(field)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', field)
  }, [isResizing])

  const handleDragOver = useCallback((e: React.DragEvent, field: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverField((prev) => prev === field ? prev : field)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverField(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetField: string) => {
    e.preventDefault()
    const dragged = draggedField
    setDraggedField(null)
    setDragOverField(null)
    if (!dragged || dragged === targetField) return
    setColumnOrder((prev) => {
      const next = [...prev]
      const from = next.indexOf(dragged)
      const to   = next.indexOf(targetField)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, dragged)
      onColumnReorder?.(next)
      return next
    })
  }, [draggedField, setColumnOrder, onColumnReorder])

  const handleDragEnd = useCallback(() => {
    setDraggedField(null)
    setDragOverField(null)
  }, [])

  return { draggedField, dragOverField, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd }
}

function useCellEdit<T>(
  rows: T[],
  columns: GridColumn<T>[],
  getRowId: (row: T) => string | number,
  onCellClick?: CustomDatagridProps<T>['onCellClick'],
) {
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; field: string } | null>(null)
  const [activeCell, setActiveCell] = useState<{ rowId: string | number; field: string } | null>(null)
  const [cellValues, setCellValues] = useState<Record<string | number, Record<string, unknown>>>({})

  useEffect(() => {
    const init: Record<string | number, Record<string, unknown>> = {}
    rows.forEach((row) => {
      const id = getRowId(row)
      init[id] = {}
      columns.forEach((col) => { init[id][col.field] = (row as Record<string, unknown>)[col.field] })
    })
    setCellValues(init)
  }, [rows, columns, getRowId])

  const handleEdit = useCallback((rowId: string | number, field: string, value: unknown) => {
    onCellClick?.({ id: rowId, field, value }, new Event('click'))
    setEditingCell({ rowId, field })
    setActiveCell({ rowId, field })
  }, [onCellClick])

  const handleValueChange = useCallback((rowId: string | number, field: string, value: unknown) => {
    setCellValues((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [field]: value } }))
  }, [])

  const handleSave = useCallback((rowId: string | number, field: string, original: unknown) => {
    const current = cellValues[rowId]?.[field]
    if (onCellClick && current !== original) {
      onCellClick({ id: rowId, field, value: current, originalValue: original }, new Event('change'))
    }
    setEditingCell(null)
    setActiveCell(null)
  }, [cellValues, onCellClick])

  return {
    editingCell, cellValues,
    isEditing: (rowId: string | number, field: string) => editingCell?.rowId === rowId && editingCell?.field === field,
    isActive:  (rowId: string | number, field: string, col: GridColumn<T>) =>
      !!col.editable && activeCell?.rowId === rowId && activeCell?.field === field,
    handleEdit, handleValueChange, handleSave,
    getRow: (id: string | number) => rows.find((r) => getRowId(r) === id),
  }
}

// ─── NoRows ───────────────────────────────────────────────────────────────────

const DefaultNoRows: React.FC<{ colSpan: number }> = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="text-center py-12 text-sm" style={{ color: 'var(--dt-muted)' }}>
      No data available
    </td>
  </tr>
)

// ─── Main Component ───────────────────────────────────────────────────────────

export function CustomDatagrid<T extends Record<string, unknown>>({
  rows = [],
  columns = [],
  CustomNoRowsOverlay,
  getRowId = DEFAULT_ROW_ID as unknown as (row: T) => string | number,
  onCellClick,
  onRowClick,
  isLoading = false,
  totalItems,
  currentPage: extPage,
  itemsPerPage: extPerPage,
  onPageChange,
  onItemsPerPageChange,
  isShowResult = true,
  enableColumnResize = true,
  minColumnWidth = 50,
  onColumnWidthChange,
  onScrollPagination = false,
  loadMoreThreshold = 150,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  onRefresh,
  onColumnReorder,
  // Selectable
  selectable       = false,
  onBulkDelete,
  bulkDeleteLabel,
  // Row actions
  onView,
  onEdit,
  onDelete,
  deleteConfirmTitle,
  deleteConfirmDescription,
}: CustomDatagridProps<T>) {
  const isMobile = useIsMobile()

  // Loading skeleton is shown for at least 600 ms to avoid flash
  const [showSkeleton, setShowSkeleton]     = useState(true)
  const [internalPage, setInternalPage]     = useState(1)
  const [internalPerPage, setInternalPerPage] = useState(25)
  const [sortConfig, setSortConfig]         = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' })
  const [columnOrder, setColumnOrder]       = useState(() => buildColumnOrder(columns as GridColumn[]))
  const [hiddenColumns, setHiddenColumns]   = useState<Set<string>>(new Set())
  const [showColumnConfig, setShowColumnConfig] = useState(false)

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string | number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Single-row delete state ──────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deletingRow, setDeletingRow]   = useState(false)

  const scrollableRef    = useRef<HTMLDivElement>(null)
  const tableRef         = useRef<HTMLTableElement>(null)
  const isLoadingMoreRef = useRef(false)
  const loadingMoreRef   = useRef(loadingMore)
  const hasMoreRef       = useRef(hasMore)
  const showSkeletonRef  = useRef(showSkeleton)

  const currentPage  = extPage    ?? internalPage
  const itemsPerPage = extPerPage ?? internalPerPage

  const hasActionCol = !!(onView || onEdit || onDelete)
  const actionsCount = [onView, onEdit, onDelete].filter(Boolean).length

  const { columnWidths, resizingColumn, handleResizeStart } = useColumnResize(columns as GridColumn[], minColumnWidth, onColumnWidthChange)
  const drag     = useColumnDragDrop(setColumnOrder, resizingColumn !== null, onColumnReorder)
  const cellEdit = useCellEdit(rows, columns, getRowId, onCellClick)

  useEffect(() => { setColumnOrder(buildColumnOrder(columns as GridColumn[])) }, [columns])

  useEffect(() => {
    if (isLoading) { setShowSkeleton(true); return }
    const t = setTimeout(() => setShowSkeleton(false), 600)
    return () => clearTimeout(t)
  }, [isLoading])

  // Clear selection on page change (traditional pagination only)
  useEffect(() => {
    if (selectable && !onScrollPagination) setSelectedIds(new Set())
  }, [currentPage, selectable, onScrollPagination])

  useEffect(() => { loadingMoreRef.current  = loadingMore  }, [loadingMore])
  useEffect(() => { hasMoreRef.current      = hasMore      }, [hasMore])
  useEffect(() => { showSkeletonRef.current = showSkeleton }, [showSkeleton])

  const allConfigColumns = useMemo(
    () => columns.filter((c) => c.field !== 'column_config' && c.field !== 'actions'),
    [columns],
  )

  const toggleColumnVisibility = useCallback((field: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }, [])

  const visibleColumns = useMemo(
    () => columnOrder
      .map((f) => columns.find((c) => c.field === f))
      .filter(Boolean)
      .filter((c) => !hiddenColumns.has(c!.field)) as GridColumn<T>[],
    [columnOrder, columns, hiddenColumns],
  )

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows
    return sortItems(rows, sortConfig.key, sortConfig.direction)
  }, [rows, sortConfig])

  const displayRows = useMemo(() => {
    if (onScrollPagination || totalItems) return rows
    return paginateItems(sortedRows, currentPage, itemsPerPage)
  }, [rows, sortedRows, currentPage, itemsPerPage, onScrollPagination, totalItems])

  const totalCount = totalItems ?? sortedRows.length
  const totalPages = onScrollPagination ? 1 : Math.ceil(totalCount / itemsPerPage) || 1
  const startItem  = onScrollPagination ? 1 : (currentPage - 1) * itemsPerPage + 1
  const endItem    = onScrollPagination ? rows.length : Math.min(currentPage * itemsPerPage, totalCount)

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return
    onPageChange ? onPageChange(page) : setInternalPage(page)
  }, [totalPages, onPageChange])

  const handlePerPageChange = useCallback((n: number) => {
    onItemsPerPageChange ? onItemsPerPageChange(n) : setInternalPerPage(n)
    handlePageChange(1)
  }, [onItemsPerPageChange, handlePageChange])

  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      key: field,
      direction: prev.key === field && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }))
  }, [])

  const triggerLoadMore = useCallback(() => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    onLoadMore!()
    setTimeout(() => { isLoadingMoreRef.current = false }, 500)
  }, [onLoadMore])

  const canLoadMore = useCallback((): boolean => {
    if (!onScrollPagination || !onLoadMore || loadingMore || !hasMore) return false
    if (isLoadingMoreRef.current) return false
    const el = scrollableRef.current
    if (!el) return false
    return el.scrollHeight - el.scrollTop - el.clientHeight <= loadMoreThreshold
  }, [onScrollPagination, onLoadMore, loadingMore, hasMore, loadMoreThreshold])

  const handleScroll = useCallback(() => {
    if (canLoadMore()) triggerLoadMore()
  }, [canLoadMore, triggerLoadMore])

  useEffect(() => {
    if (!onScrollPagination) return
    const el = scrollableRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [onScrollPagination, handleScroll, showSkeleton])

  useEffect(() => {
    if (!onScrollPagination || !onLoadMore || loadingMore || !hasMore || showSkeleton) return
    const id = requestAnimationFrame(() => {
      const el = scrollableRef.current
      if (!el) return
      if (el.scrollHeight <= el.clientHeight + loadMoreThreshold) triggerLoadMore()
    })
    return () => cancelAnimationFrame(id)
  }, [rows.length, onScrollPagination, onLoadMore, loadingMore, hasMore, showSkeleton, loadMoreThreshold, triggerLoadMore])

  useEffect(() => {
    if (!onScrollPagination || !onLoadMore) return
    const el = scrollableRef.current
    if (!el) return
    const check = () => {
      if (loadingMoreRef.current || !hasMoreRef.current || showSkeletonRef.current) return
      if (el.scrollHeight <= el.clientHeight + loadMoreThreshold) triggerLoadMore()
    }
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onScrollPagination, onLoadMore, loadMoreThreshold, triggerLoadMore])

  // ── Selection helpers ────────────────────────────────────────────────────
  const allDisplayIds    = displayRows.map(getRowId)
  const allSelected      = allDisplayIds.length > 0 && allDisplayIds.every((id) => selectedIds.has(id))
  const someSelected     = !allSelected && allDisplayIds.some((id) => selectedIds.has(id))

  const toggleRow = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = displayRows.map(getRowId)
      const allIn  = allIds.every((id) => prev.has(id))
      const next   = new Set(prev)
      if (allIn) allIds.forEach((id) => next.delete(id))
      else       allIds.forEach((id) => next.add(id))
      return next
    })
  }, [displayRows, getRowId])

  // ── Bulk delete handler ──────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete) return
    setBulkDeleting(true)
    try {
      await onBulkDelete([...selectedIds])
      setSelectedIds(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }, [onBulkDelete, selectedIds])

  // ── Single row delete handler ────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (!onDelete || !deleteTarget) return
    setDeletingRow(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeletingRow(false)
    }
  }, [onDelete, deleteTarget])

  // ── Column span for empty/loading rows (checkbox + data + actions + settings) ──
  const totalColSpan = visibleColumns.length + (selectable ? 1 : 0) + (hasActionCol ? 1 : 0) + 1

  // ─── Skeleton return — includes exact-replica footer ─────────────────────
  if (showSkeleton) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--dt-bg)', overflow: 'hidden' }}>
        <style>{SCROLL_CSS}</style>
        <TableSkeleton
          columns={visibleColumns as GridColumn[]}
          columnWidths={columnWidths}
          minColumnWidth={minColumnWidth}
          hasSelect={selectable}
          actionsCount={actionsCount}
        />
        {onScrollPagination ? (
          <ScrollCounter count={0} total={0} onRefresh={onRefresh} isLoading />
        ) : (
          <TablePagination
            currentPage={1} totalPages={1} startItem={0} endItem={0} totalCount={0}
            itemsPerPage={itemsPerPage} isLoading isShowResult={isShowResult} isMobile={isMobile}
            onPageChange={() => {}} onItemsPerPageChange={() => {}}
          />
        )}
      </div>
    )
  }

  const emptyRow = CustomNoRowsOverlay
    ? <tr><td colSpan={totalColSpan}><CustomNoRowsOverlay /></td></tr>
    : <DefaultNoRows colSpan={totalColSpan} />

  return (
    <div
      className={`flex flex-col relative ${resizingColumn ? 'select-none' : ''}`}
      style={{ height: '100%', background: 'var(--dt-bg)', overflow: 'hidden' }}
    >
      <style>{SCROLL_CSS}</style>

      {/* ── Scrollable table area ─────────────────────────────────────── */}
      <div
        ref={scrollableRef}
        className="overflow-x-auto overflow-y-auto cdg-scroll"
        style={{
          flex: '1 1 0', height: 0, minHeight: 300,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--dt-scrollbar) transparent',
          overscrollBehavior: 'contain',
        }}
      >
        <table
          ref={tableRef}
          className="w-full border-collapse"
          style={{ tableLayout: 'fixed', background: 'var(--dt-bg)' }}
        >
          {/* ── Column headers ─────────────────────────────────────────── */}
          <thead className="sticky top-0 z-40" style={{ background: 'var(--dt-header)' }}>
            <tr>
              {/* Checkbox column header */}
              {selectable && (
                <th
                  style={{
                    width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH,
                    padding: '0 13px', height: 37,
                    background: 'var(--dt-header)',
                    borderBottom: '1px solid var(--dt-border)',
                  }}
                >
                  <CheckboxCell
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  />
                </th>
              )}

              {/* Data column headers */}
              {visibleColumns.map((col) => (
                <HeaderCell
                  key={col.field}
                  column={col}
                  width={getColWidth(col as GridColumn, columnWidths)}
                  minColumnWidth={minColumnWidth}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  isDragging={drag.draggedField === col.field}
                  isDragOver={drag.dragOverField === col.field}
                  resizingField={resizingColumn}
                  enableResize={enableColumnResize}
                  onDragStart={drag.handleDragStart}
                  onDragOver={drag.handleDragOver}
                  onDragLeave={drag.handleDragLeave}
                  onDrop={drag.handleDrop}
                  onDragEnd={drag.handleDragEnd}
                  onResizeStart={handleResizeStart}
                />
              ))}

              {/* Actions column header — always last user-visible column */}
              {hasActionCol && (
                <th
                  style={{
                    width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH,
                    padding: '0 8px', height: 37,
                    background: 'var(--dt-header)',
                    borderBottom: '1px solid var(--dt-border)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dt-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Actions
                  </span>
                </th>
              )}

              {/* Fields toggle button — sticky right */}
              <th
                className="sticky right-0 z-50"
                style={{
                  width: 36, minWidth: 36, padding: 0,
                  background: 'var(--dt-header)',
                  borderLeft: '1px solid var(--dt-border)',
                  borderBottom: '1px solid var(--dt-border)',
                }}
              >
                <button
                  onClick={() => setShowColumnConfig((v) => !v)}
                  className="flex items-center justify-center w-full transition-colors"
                  style={{
                    height: 37,
                    color: showColumnConfig ? 'var(--dt-text)' : 'var(--dt-muted)',
                    background: showColumnConfig ? 'var(--dt-hover)' : 'transparent',
                  }}
                  title="Configure fields"
                  onMouseEnter={e => { if (!showColumnConfig) e.currentTarget.style.color = 'var(--dt-dim)' }}
                  onMouseLeave={e => { if (!showColumnConfig) e.currentTarget.style.color = 'var(--dt-muted)' }}
                >
                  <Settings2 size={13} />
                </button>
              </th>
            </tr>
          </thead>

          {/* ── Data rows ─────────────────────────────────────────────── */}
          <tbody>
            {displayRows.length === 0
              ? emptyRow
              : displayRows.map((row) => {
                const rowId     = getRowId(row)
                const isSelected = selectable && selectedIds.has(rowId)
                return (
                  <tr
                    key={rowId}
                    className={`h-8 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    style={{
                      borderBottom: '1px solid var(--dt-border)',
                      background: isSelected ? 'var(--dt-hover)' : 'transparent',
                    }}
                    onClick={() => onRowClick?.(row)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--dt-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isSelected ? 'var(--dt-hover)' : 'transparent')}
                  >
                    {/* Checkbox cell */}
                    {selectable && (
                      <td
                        style={{ width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, padding: '0 13px', height: 32 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <CheckboxCell
                          checked={isSelected}
                          onChange={() => toggleRow(rowId)}
                        />
                      </td>
                    )}

                    {/* Data cells */}
                    {visibleColumns.map((col) => (
                      <DataCell
                        key={col.field}
                        row={row}
                        column={col}
                        rowId={rowId}
                        cellValue={cellEdit.cellValues[rowId]?.[col.field] ?? (row as Record<string, unknown>)[col.field]}
                        isEditing={cellEdit.isEditing(rowId, col.field)}
                        isActiveBorder={cellEdit.isActive(rowId, col.field, col)}
                        minColumnWidth={minColumnWidth}
                        width={getColWidth(col as GridColumn, columnWidths)}
                        onEdit={cellEdit.handleEdit}
                        onSave={cellEdit.handleSave}
                        onValueChange={cellEdit.handleValueChange}
                        getRow={cellEdit.getRow as (id: string | number) => T | undefined}
                      />
                    ))}

                    {/* Actions cell — always after data columns */}
                    {hasActionCol && (
                      <td
                        style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, padding: '0 8px', height: 32 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {onView && (
                            <ActionIconBtn
                              icon={<Eye size={13} />}
                              title="View"
                              onClick={(e) => { e.stopPropagation(); onView(row) }}
                            />
                          )}
                          {onEdit && (
                            <ActionIconBtn
                              icon={<Pencil size={13} />}
                              title="Edit"
                              onClick={(e) => { e.stopPropagation(); onEdit(row) }}
                            />
                          )}
                          {onDelete && (
                            <ActionIconBtn
                              icon={<Trash2 size={13} />}
                              title="Delete"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }}
                              color="var(--dt-muted)"
                              hoverColor="#ef4444"
                              hoverBg="rgba(239,68,68,0.08)"
                            />
                          )}
                        </div>
                      </td>
                    )}

                    {/* Aligns with the settings <th> */}
                    <td
                      className="sticky right-0"
                      style={{
                        width: 36, minWidth: 36, padding: 0,
                        background: 'var(--dt-bg)',
                        borderLeft: '1px solid var(--dt-border)',
                      }}
                    />
                  </tr>
                )
              })
            }

            {/* Spinner row while loading more */}
            {loadingMore && (
              <tr>
                <td colSpan={totalColSpan} className="text-center py-3 text-xs" style={{ color: 'var(--dt-muted)' }}>
                  <RefreshCw size={14} className="inline animate-spin mr-1" />
                  Loading more…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {onScrollPagination ? (
        <ScrollCounter count={rows.length} total={totalCount} onRefresh={onRefresh} />
      ) : (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startItem={startItem}
          endItem={endItem}
          totalCount={totalCount}
          itemsPerPage={itemsPerPage}
          isLoading={isLoading}
          isShowResult={isShowResult}
          isMobile={isMobile}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handlePerPageChange}
        />
      )}

      {/* ── Fields panel overlay ─────────────────────────────────────── */}
      {showColumnConfig && (
        <ColumnConfigPanel
          allColumns={allConfigColumns as GridColumn[]}
          hiddenColumns={hiddenColumns}
          onToggle={toggleColumnVisibility}
          onClose={() => setShowColumnConfig(false)}
        />
      )}

      {/* ── Bulk action bar — slides up from bottom when rows selected ── */}
      {selectable && onBulkDelete && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeleteAll={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          loading={bulkDeleting}
          warningLabel={bulkDeleteLabel}
        />
      )}

      {/* ── Single-row delete confirmation modal ─────────────────────── */}
      {onDelete && (
        <ConfirmDeleteModal
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          loading={deletingRow}
          title={deleteConfirmTitle}
          description={deleteConfirmDescription}
          zIndex={99999}
        />
      )}
    </div>
  )
}

export default CustomDatagrid
