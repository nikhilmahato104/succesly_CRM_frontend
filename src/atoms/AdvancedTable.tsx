import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MyInput } from './MyInput';
import { MyButton } from './MyButton';
import { Loader } from './Loader';
import { MyTableSkeleton } from "./MyTableSkeleton";
import { COLORS } from "../../src/theme/colors";


interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

type ServerPagination = {
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (n: number) => void;
};

interface ActionDef {
  label: string;
  key: string;
  icon?: React.ReactNode;
  className?: string;
}

// Add new interface for empty state customization
interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AdvancedTableProps {
  data: any[];
  columns: Column[];
  onRowAction?: (action: string, row: any) => void;
  actions?: ActionDef[];
  pagination?: boolean | ServerPagination;
  itemsPerPage?: number;
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  leftToolbar?: React.ReactNode;
  rightToolbar?: React.ReactNode;
  showBuiltinSearch?: boolean;
  minHeight?: string;
  title?: string | null;
  itemsPerPageOptions?: number[];
  showItemsPerPage?: boolean;
  loading?: boolean;
  // Add new empty state props
  emptyState?: EmptyStateProps;
  hasSearch?: boolean; // To know if there's an active search

  // ✅ NEW PROPS (ADD HERE)
  rowClickable?: boolean;
  onRowClick?: (row: any) => void;
  disableRowClickOnActions?: boolean;

}

export const AdvancedTable: React.FC<AdvancedTableProps> = ({
  data,
  columns,
  onRowAction,
  actions = [],
  // ✅ NEW
  rowClickable = false,
  onRowClick,
  disableRowClickOnActions = true,

  pagination = true,
  itemsPerPage = 10,
  onSortChange,
  leftToolbar,
  rightToolbar,
  showBuiltinSearch = true,
  minHeight = '500px',
  title,
  itemsPerPageOptions = [10, 25, 50, 100],
  showItemsPerPage = true,
  loading = false,
  // New props
  emptyState,
  hasSearch = false,
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');
  const [currentPageUncontrolled, setCurrentPageUncontrolled] = useState(1);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);
  const isDarkMode = document.documentElement.classList.contains("dark");

  const perPageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (perPageDropdownRef.current && !perPageDropdownRef.current.contains(event.target as Node)) {
        if (showPerPageDropdown) {
          setShowPerPageDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPerPageDropdown]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isServerControlled = typeof pagination === 'object' && pagination !== null;

  const page = isServerControlled ? (pagination as ServerPagination).page : currentPageUncontrolled;
  const perPage = isServerControlled ? (pagination as ServerPagination).perPage : itemsPerPage;
  const totalForHeader = isServerControlled ? (pagination as ServerPagination).total : undefined;

  const filteredData = useMemo(() => {
    if (!filterText) return data;
    const t = filterText.toLowerCase();
    return data.filter(item =>
      Object.values(item).some(value => {
        try {
          return String(value).toLowerCase().includes(t);
        } catch {
          return false;
        }
      })
    );
  }, [data, filterText]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      const aStr = typeof aValue === 'string' ? aValue : JSON.stringify(aValue);
      const bStr = typeof bValue === 'string' ? bValue : JSON.stringify(bValue);
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const totalPages = isServerControlled
    ? Math.max(1, Math.ceil((pagination as ServerPagination).total / perPage))
    : Math.max(1, Math.ceil(sortedData.length / perPage));

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    if (isServerControlled) return data;
    const startIndex = (page - 1) * perPage;
    return sortedData.slice(startIndex, startIndex + perPage);
  }, [sortedData, pagination, isServerControlled, page, perPage, data]);

  const handleSort = (key: string) => {
    const next: { key: string; direction: 'asc' | 'desc' } = {
      key,
      direction: sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    };
    setSortConfig(next);
    onSortChange?.(next.key, next.direction);
    if (!isServerControlled) setCurrentPageUncontrolled(1);
    else (pagination as ServerPagination).onPageChange(1);
  };

  useEffect(() => {
    if (!isServerControlled && page > totalPages) setCurrentPageUncontrolled(1);
  }, [isServerControlled, page, totalPages]);

  const goPrev = () => {
    if (page <= 1) return;
    if (isServerControlled) (pagination as ServerPagination).onPageChange(page - 1);
    else setCurrentPageUncontrolled(p => Math.max(p - 1, 1));
  };

  const goNext = () => {
    if (page >= totalPages) return;
    if (isServerControlled) (pagination as ServerPagination).onPageChange(page + 1);
    else setCurrentPageUncontrolled(p => Math.min(p + 1, totalPages));
  };

  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    if (isServerControlled) (pagination as ServerPagination).onPageChange(pageNum);
    else setCurrentPageUncontrolled(pageNum);
  };

  const handlePerPageChange = (newPerPage: number) => {
    if (isServerControlled && (pagination as ServerPagination).onPerPageChange) {
      (pagination as ServerPagination).onPerPageChange?.(newPerPage);
      (pagination as ServerPagination).onPageChange(1);
    }
    setShowPerPageDropdown(false);
  };

  const startIdx = (page - 1) * perPage + (paginatedData.length ? 1 : 0);
  const endIdx = (page - 1) * perPage + paginatedData.length;
  const resultsCount = isServerControlled ? (pagination as ServerPagination).total : sortedData.length;

  const computedTitle =
    title === undefined
      ? `Data Table (${(totalForHeader ?? sortedData.length)} items)`
      : title;

  const getDisplayedPageNumbers = () => {
    const maxPageDisplay = isMobile ? 2 : 5;
    const start = Math.max(1, page - Math.floor(maxPageDisplay / 2));
    const end = Math.min(totalPages, start + maxPageDisplay - 1);
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const displayedPages = getDisplayedPageNumbers();

  // Default empty state configuration
  const defaultEmptyState = {
    // icon: "📊",
    icon: "",
    title: "No records found",
    description: "Try adjusting your search or filters",
  };

  // Merge custom empty state with defaults
  const currentEmptyState = {
    ...defaultEmptyState,
    ...emptyState,
  };

  // Render empty state component
  const renderEmptyState = () => {
    // If custom emptyStateComponent is provided, use it
    if (emptyState?.action) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">{currentEmptyState.icon}</div>
          <div className="text-lg text-gray-600 dark:text-gray-400 mb-2 text-center">
            {currentEmptyState.title}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500 text-center mb-4">
            {currentEmptyState.description}
          </div>
          {emptyState.action && (
            <button
              onClick={emptyState.action.onClick}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              {emptyState.action.label}
            </button>
          )}
        </div>
      );
    }

    // Default empty state
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-6xl mb-4">{currentEmptyState.icon}</div>
        <div className="text-lg text-gray-600 dark:text-gray-400 mb-2 text-center">
          {currentEmptyState.title}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500 text-center">
          {currentEmptyState.description}
        </div>
      </div>
    );
  };

  return (
    <div
      // className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
      className="bg-white text-gray-900 dark:bg-black dark:text-white rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
      style={{ minHeight }}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 sm:border-b flex-shrink-0 border-b-0 sm:border-b"
      style={{
    backgroundColor: isDarkMode ? "#2f2f2f" : "#ffffff"
  }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
            {computedTitle !== null && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {computedTitle}
              </h3>
            )}
            <div className="mt-3 sm:mt-0 hidden sm:flex">
              {leftToolbar}
            </div>
          </div>

          <div className="mt-3 sm:mt-0 hidden sm:flex">
            {rightToolbar ?? (
              showBuiltinSearch && (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <MyInput
                    type="text"
                    placeholder="Search..."
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      if (isServerControlled) (pagination as ServerPagination).onPageChange(1);
                      else setCurrentPageUncontrolled(1);
                    }}
                    leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                    className="w-full "
                  />
                  <MyButton variant="ghost" size="sm" className="hidden sm:flex">
                    <Filter className="h-4 w-4" />
                  </MyButton>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto relative">
        {/* {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <Loader size="md" />
          </div>
        )} */}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm z-50">
            <Loader size="md" />
          </div>
        )}

        {/* SKELTON */}
        {/* {loading && (
          <div className="absolute inset-0 z-50 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm">
            <MyTableSkeleton
              rows={perPage}
              columns={columns.length + (actions.length > 0 ? 1 : 0)}
            />
          </div>
        )} */}



        {/* Desktop Table */}
        <div className="hidden sm:block">
          <table className="w-full">
            {/* <thead className="bg-gray-50 dark:bg-gray-700"> */}
            <thead className="bg-gray-50 dark:bg-[#0f0f0f]">
              <tr>
                {columns.map((column) => (
                  // <th
                  //   key={column.key}
                  //   className={clsx(
                  //     'px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider',
                  //     { 'cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1a1a1a]': column.sortable }
                  //   )}
                  //   onClick={() => column.sortable && handleSort(column.key)}
                  // >
                  <th
                    key={column.key}
                    className={clsx(
                      'px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap',
                      { 'cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1a1a1a]': column.sortable }
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >

                    <div className="flex items-center">
                      <span className="text-xs sm:text-xs">{column.label}</span>
                    

                      {column.sortable && (
                        <div className="ml-1">
                          {sortConfig?.key === column.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            ) : (
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                            )
                          ) : (
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-30" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <span className="text-xs sm:text-xs">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                    className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {renderEmptyState()}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => {
                  const rowId = (row._id || row.id || row.shortId || rowIndex).toString();
                  return (
                    // <tr
                    //   key={rowId}
                    //   className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    // >
                    <tr
                      key={rowId}
                      onClick={() => {
                        if (rowClickable && onRowClick) {
                          onRowClick(row);
                        }
                      }}
                      className={clsx(
                        "transition-colors",
                        rowClickable && "cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
                      )}
                    >

                      {columns.map((column) => (
                        // <td
                        //   key={column.key}
                        //   className="px-3 sm:px-6 py-3 text-xs sm:text-sm text-gray-900 dark:text-white"

                        // >
                        <td
                          key={column.key}
                          // className="px-3 sm:px-6 py-3 text-[11px] sm:text-xs text-gray-900 dark:text-white"
                           className="px-3 sm:px-6 py-3 text-xs sm:text-sm text-gray-900 dark:text-white"

                        >

                          {column.render ? column.render(row[column.key], row) : (
                            <span className="line-clamp-2">{row[column.key]}</span>
                          )}
                        </td>
                      ))}
                      {actions.length > 0 && (
                        // <td className="px-3 sm:px-6 py-3 text-right align-top">
                        <td
                          className="px-3 sm:px-6 py-3 text-right align-top"
                          onClick={(e) => {
                            if (disableRowClickOnActions) {
                              e.stopPropagation();
                            }
                          }}
                        >

                          <div className="flex items-start justify-end gap-4">
                            {actions.map((action) => (
                              <div key={action.key} className="flex flex-col items-center">
                                <span
                                  className={clsx(
                                    'text-[11px] mb-1 select-none',
                                    action.key === 'delete' ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'
                                  )}
                                >
                                  {action.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onRowAction?.(action.key, row)}
                                  title={action.label}
                                  aria-label={`${action.label} ${String(row?.company_name ?? row?.id ?? '')}`}
                                  className={clsx(
                                    'p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700',
                                    action.className ?? ''
                                  )}
                                >
                                  <span className="inline-flex items-center justify-center">
                                    {action.icon ?? <span className="w-4 h-4 inline-block" />}
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden px-3 mt-3 border-t-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex-1">
              {leftToolbar ? (
                <div className="flex items-center gap-2">{leftToolbar}</div>
              ) : showBuiltinSearch ? (
                <MyInput
                  type="text"
                  placeholder="Search..."
                  value={filterText}
                  onChange={(e) => {
                    setFilterText(e.target.value);
                    if (isServerControlled) (pagination as ServerPagination).onPageChange(1);
                    else setCurrentPageUncontrolled(1);
                  }}
                  leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                  className="w-full"
                />
              ) : null}
            </div>

            <div className="flex items-center gap-2 ml-2">
              {rightToolbar ? (
                <div className="flex items-center gap-2">{rightToolbar}</div>
              ) : null}
            </div>
          </div>

          {paginatedData.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              {renderEmptyState()}
            </div>
          ) : (
            paginatedData.map((row, rowIndex) => (
              // <div
              //   key={row._id || row.id || rowIndex}
              //   className="mb-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm"
              // >
              <div
                key={row._id || row.id || rowIndex}
                onClick={() => {
                  if (rowClickable && onRowClick) {
                    onRowClick(row);
                  }
                }}
                className={clsx(
                  "mb-3 bg-white dark:bg-gray-800 border rounded-lg p-3 shadow-sm ",
                  rowClickable && "cursor-pointer"
                )}
              >

                <div className="flex flex-col space-y-2">
                  {columns.map((column) => (
                    <div key={column.key} className="flex justify-between items-start">
                      <div className="text-xs text-gray-500 dark:text-gray-400">{column.label}</div>
                      <div className="text-sm text-gray-900 dark:text-white max-w-[60%] text-right">
                        {column.render ? column.render(row[column.key], row) : <span className="break-words">{String(row[column.key] ?? '')}</span>}
                      </div>
                    </div>
                  ))}
                  {actions.length > 0 && (
                    <div className="mt-2 flex flex-row gap-2 justify-end">
                      {actions.map((action) => (
                        <button
                          key={action.key}
                          onClick={() => onRowAction?.(action.key, row)}
                          className="flex items-center gap-2 text-xs py-2 px-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90"
                        >
                          {action.icon && <span className="inline-flex items-center">{action.icon}</span>}
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pagination && totalPages > 0 && (
        // <div className="px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
        <div className="px-4 sm:px-6 py-4 bg-white dark:bg-[#0f0f0f] border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {showItemsPerPage && (
              <div className="flex items-center space-x-2" ref={perPageDropdownRef}>
                <span className="text-sm text-gray-600 dark:text-gray-400">Show Result</span>
                <div className="relative">
                  <button
                    onClick={() => !loading && setShowPerPageDropdown(!showPerPageDropdown)}
                    className={clsx(
                      'flex items-center space-x-1 px-3 py-1.5 border rounded-md bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300',
                      loading
                        ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    )}
                    disabled={loading}
                  >
                    <span>{perPage}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showPerPageDropdown && !loading && (
                    <div className="absolute right-0 bottom-full mb-1 w-24 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50">
                      {itemsPerPageOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => handlePerPageChange(option)}
                          className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] first:rounded-t-md last:rounded-b-md"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-semibold text-gray-900 dark:text-white">{startIdx}</span> to{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{endIdx}</span> of{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{resultsCount}</span> entries
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={goPrev}
                disabled={page === 1 || loading}
                className={clsx(
                  'p-2 rounded-full border transition-colors',
                  page === 1 || loading
                    ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {/* {displayedPages.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => !loading && goToPage(pageNum)}
                  className={clsx(
                    'min-w-[2rem] h-8 px-2 text-sm font-medium rounded-full transition-colors',
                    pageNum === page
                      ? 'bg-[#7C4DFF] text-white border border-[#7C4DFF]'
                      : loading
                        ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                        : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
                  )}
                  disabled={loading}
                >
                  {pageNum}
                </button>
              ))} */}
              {displayedPages.map((pageNum) => {
                const isActive = pageNum === page;

                const activeStyle: React.CSSProperties & Record<string, string> | undefined =
                  isActive
                    ? {
                      "--primary": COLORS.primary.DEFAULT,
                      "--primary-hover": COLORS.primary.hover,
                      "--primary-active": COLORS.primary.active,
                    }
                    : undefined;

                return (
                  <button
                    key={pageNum}
                    onClick={() => !loading && goToPage(pageNum)}
                    style={activeStyle}
                    className={clsx(
                      "min-w-[2rem] h-8 px-2 text-sm font-medium rounded-full transition-colors",
                      isActive
                        ? "bg-[var(--primary)] text-[var(--primary-text)] border border-[var(--primary)]"
                        : loading
                          ? "border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed"
                          : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
                    )}
                    disabled={loading}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={goNext}
                disabled={page === totalPages || loading}
                className={clsx(
                  'p-2 rounded-full border transition-colors',
                  page === totalPages || loading
                    ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="sm:hidden flex items-center justify-between mt-4">
            <button
              onClick={goPrev}
              disabled={page === 1 || loading}
              className={clsx(
                'flex-1 mr-2 py-2 text-sm font-medium rounded-lg border transition-colors',
                page === 1 || loading
                  ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
              )}
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={goNext}
              disabled={page === totalPages || loading}
              className={clsx(
                'flex-1 ml-2 py-2 text-sm font-medium rounded-lg border transition-colors',
                page === totalPages || loading
                  ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedTable;