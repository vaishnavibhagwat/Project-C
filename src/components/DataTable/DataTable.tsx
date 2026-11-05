import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type TableHTMLAttributes,
} from 'react';
import { TableVirtuoso, type ItemProps, type TableComponents } from 'react-virtuoso';
import { Popover } from '../Popover';
import { SearchInput } from '../SearchInput';
import { EmptyState } from '../StateViews';
import { cx } from '@/utils/cx';
import { downloadCsv } from '@/utils/download';
import { formatNumber } from '@/utils/format';
import {
  filterRows,
  moveColumn,
  nextSort,
  orderColumns,
  pageOf,
  shiftColumn,
  sortRows,
  toCsv,
  type DataTableColumn,
  type SortRule,
} from './tableModel';

export interface DataTableProps<T> {
  /** Accessible name of the table (also the CSV export's subject). */
  caption: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Sort keys in priority order. Click a header to sort; shift-click to add a key. */
  sort: readonly SortRule[];
  onSortChange: (sort: SortRule[]) => void;
  /** Saved column order (ids); columns not listed keep their default place at the end. */
  columnOrder: readonly string[];
  onColumnOrderChange: (order: string[]) => void;
  hiddenColumns: readonly string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  /** Rows per page; 0 shows every row in one virtual-scrolling list. */
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: readonly number[];
  /** Row activation (click, Enter or Space on a focused row). */
  onRowClick?: (row: T) => void;
  /** Accessible description of the row action, e.g. "Select RELIANCE". */
  rowActionLabel?: (row: T) => string;
  /** Footer cells by column id, computed from the filtered rows. */
  footer?: (rows: readonly T[]) => Partial<Record<string, ReactNode>>;
  /** When set, shows "Export CSV" and saves the filtered, sorted rows under this name. */
  exportFileName?: string;
  /** Extra content at the start of the toolbar (e.g. a live indicator). */
  toolbarStart?: ReactNode;
}

interface RowContext<T> {
  onRowClick?: (row: T) => void;
  rowActionLabel?: (row: T) => string;
}

const TableEl = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  function TableEl(props, ref) {
    return <table {...props} ref={ref} className="w-full border-collapse" />;
  },
);
const TableHead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHead(props, ref) {
    return <thead {...props} ref={ref} className="z-[1]" />;
  },
);

/** Virtuoso table parts; the row reads the click handler from Virtuoso's context. */
function makeParts<T>(): TableComponents<T, RowContext<T>> {
  function TableRow({ item, context, ...props }: ItemProps<T> & { context?: RowContext<T> }) {
    const onRowClick = context?.onRowClick;
    if (!onRowClick) return <tr {...props} className="hover:bg-raised" />;
    const activate = (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRowClick(item);
      }
    };
    return (
      <tr
        {...props}
        tabIndex={0}
        aria-label={context.rowActionLabel?.(item)}
        onClick={() => onRowClick(item)}
        onKeyDown={activate}
        className="cursor-pointer hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      />
    );
  }
  return { Table: TableEl, TableHead, TableRow };
}

const toolButton =
  'h-6 rounded border border-line px-2 text-2xs text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40';

/**
 * Reusable data table: virtual scrolling (react-virtuoso) or pages, multi-column sort, search
 * across every column, drag-to-reorder headers, a column picker and CSV export. Sort, order,
 * visibility and page size are controlled so the owner can persist them; the search text and
 * the current page are local.
 */
export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  sort,
  onSortChange,
  columnOrder,
  onColumnOrderChange,
  hiddenColumns,
  onHiddenColumnsChange,
  pageSize,
  onPageSizeChange,
  pageSizes = [0, 25, 50, 100],
  onRowClick,
  rowActionLabel,
  footer,
  exportFileName,
  toolbarStart,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const parts = useMemo(() => makeParts<T>(), []);

  const ordered = useMemo(() => orderColumns(columns, columnOrder), [columns, columnOrder]);
  const orderIds = useMemo(() => ordered.map((c) => c.id), [ordered]);
  const visible = useMemo(
    () => ordered.filter((c) => !hiddenColumns.includes(c.id)),
    [ordered, hiddenColumns],
  );
  const filtered = useMemo(() => filterRows(rows, columns, query), [rows, columns, query]);
  const sorted = useMemo(() => sortRows(filtered, columns, sort), [filtered, columns, sort]);
  const page = pageOf(sorted.length, pageSize, pageIndex);
  const pageRows = useMemo(
    () => (pageSize > 0 ? sorted.slice(page.from, page.to) : sorted),
    [sorted, page.from, page.to, pageSize],
  );
  const footerCells = useMemo(() => footer?.(sorted), [footer, sorted]);
  const context = useMemo<RowContext<T>>(
    () => ({ onRowClick, rowActionLabel }),
    [onRowClick, rowActionLabel],
  );

  const onSearch = useCallback((q: string) => {
    setQuery(q);
    setPageIndex(0);
  }, []);
  const onHeaderClick = (col: DataTableColumn<T>, e: MouseEvent<HTMLButtonElement>) => {
    onSortChange(nextSort(sort, col.id, e.shiftKey, col.align === 'right' ? 'desc' : 'asc'));
    setPageIndex(0);
  };
  const exportCsv = () => {
    if (exportFileName) downloadCsv(exportFileName, toCsv(sorted, visible));
  };
  const setHidden = (id: string, hide: boolean) => {
    const next = hide ? [...hiddenColumns, id] : hiddenColumns.filter((x) => x !== id);
    if (visible.length - (hide ? 1 : 0) >= 1) onHiddenColumnsChange(next);
  };

  // Drag a header onto another to move it there (HTML5 drag and drop). The column picker
  // offers the same moves from the keyboard.
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLTableCellElement>) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      setDragging(id);
    },
    onDragOver: (e: DragEvent<HTMLTableCellElement>) => {
      if (dragging === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(id);
    },
    onDragLeave: () => setDropTarget((t) => (t === id ? null : t)),
    onDrop: (e: DragEvent<HTMLTableCellElement>) => {
      e.preventDefault();
      const from = e.dataTransfer.getData('text/plain') || dragging;
      if (from) onColumnOrderChange(moveColumn(orderIds, from, id));
      setDragging(null);
      setDropTarget(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setDropTarget(null);
    },
  });

  const sortText = sort
    .flatMap((r) => {
      const c = columns.find((x) => x.id === r.id);
      return c ? [`${c.header} ${r.dir === 'asc' ? 'ascending' : 'descending'}`] : [];
    })
    .join(', then ');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        {toolbarStart}
        <SearchInput
          label={`Search ${caption.toLowerCase()} in every column`}
          placeholder="Search all columns"
          onSearch={onSearch}
          debounceMs={150}
          className="min-w-[120px] flex-1"
        />
        <span className="num whitespace-nowrap text-2xs text-muted">
          {formatNumber(sorted.length)} of {formatNumber(rows.length)}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1 text-2xs text-muted">
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                setPageIndex(0);
              }}
              className="h-6 rounded border border-line bg-bg px-1 text-2xs text-fg focus:border-accent focus:outline-none"
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'All (scroll)' : n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Popover
          label="Columns"
          width="w-60"
          trigger={(props) => (
            <button type="button" className={toolButton} {...props}>
              Columns
            </button>
          )}
        >
          {() => (
            <ul className="flex flex-col gap-0.5 p-2 text-xs">
              {ordered.map((c, i) => {
                const shown = !hiddenColumns.includes(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <label className="flex flex-1 items-center gap-1.5 py-0.5 text-fg">
                      <input
                        type="checkbox"
                        checked={shown}
                        disabled={shown && visible.length === 1}
                        onChange={(e) => setHidden(c.id, !e.target.checked)}
                      />
                      {c.header}
                    </label>
                    <button
                      type="button"
                      aria-label={`Move ${c.header} earlier`}
                      disabled={i === 0}
                      onClick={() => onColumnOrderChange(shiftColumn(orderIds, c.id, -1))}
                      className="rounded px-1 text-muted hover:bg-raised hover:text-fg disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${c.header} later`}
                      disabled={i === ordered.length - 1}
                      onClick={() => onColumnOrderChange(shiftColumn(orderIds, c.id, 1))}
                      className="rounded px-1 text-muted hover:bg-raised hover:text-fg disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover>
        {exportFileName ? (
          <button type="button" className={toolButton} onClick={exportCsv}>
            Export CSV
          </button>
        ) : null}
      </div>
      <p className="sr-only" role="status">
        {`${sorted.length} of ${rows.length} rows${sortText ? `, sorted by ${sortText}` : ''}.`}
      </p>
      {sorted.length === 0 ? (
        <EmptyState title="No rows match" message="Clear the search to see every row." />
      ) : (
        <TableVirtuoso
          className="scroll-thin min-h-0 flex-1"
          components={parts}
          context={context}
          data={pageRows}
          computeItemKey={(_, row) => getRowId(row)}
          increaseViewportBy={160}
          fixedHeaderContent={() => (
            <tr className="bg-panel">
              {visible.map((c) => {
                const ruleIndex = sort.findIndex((r) => r.id === c.id);
                const rule = sort[ruleIndex];
                const sortable = c.sortable !== false;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={rule ? (rule.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    style={{ minWidth: c.minWidth }}
                    className={cx(
                      'h-7 cursor-grab whitespace-nowrap border-b border-line px-2 text-2xs font-medium uppercase tracking-wide text-muted',
                      c.align === 'right' ? 'text-right' : 'text-left',
                      dragging === c.id && 'opacity-50',
                      dropTarget === c.id &&
                        dragging !== c.id &&
                        'bg-raised shadow-[inset_2px_0_0] shadow-accent',
                    )}
                    {...dragProps(c.id)}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={(e) => onHeaderClick(c, e)}
                        title="Click to sort. Shift-click to add to the sort. Drag to move."
                        className={cx(
                          'inline-flex items-center gap-0.5 uppercase hover:text-fg',
                          rule && 'text-fg',
                        )}
                      >
                        {c.header}
                        <span aria-hidden="true" className="text-[9px] normal-case">
                          {rule ? (rule.dir === 'asc' ? '▲' : '▼') : ''}
                          {rule && sort.length > 1 ? ruleIndex + 1 : ''}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          )}
          itemContent={(_, row) =>
            visible.map((c) => (
              <td
                key={c.id}
                style={{ minWidth: c.minWidth }}
                className={cx(
                  'h-8 whitespace-nowrap border-b border-line px-2 text-xs',
                  c.align === 'right' ? 'num text-right' : 'text-left',
                )}
              >
                {c.render ? c.render(row) : c.value(row)}
              </td>
            ))
          }
          fixedFooterContent={
            footerCells
              ? () => (
                  <tr className="bg-raised">
                    {visible.map((c) => (
                      <td
                        key={c.id}
                        className={cx(
                          'h-7 whitespace-nowrap px-2 text-xs font-medium',
                          c.align === 'right' ? 'num text-right' : 'text-left',
                        )}
                      >
                        {footerCells[c.id] ?? null}
                      </td>
                    ))}
                  </tr>
                )
              : undefined
          }
        />
      )}
      {pageSize > 0 && sorted.length > 0 ? (
        <nav
          aria-label="Pages"
          className="flex items-center justify-end gap-2 border-t border-line px-3 py-1 text-2xs text-muted"
        >
          <button
            type="button"
            className={toolButton}
            disabled={page.index === 0}
            onClick={() => setPageIndex(page.index - 1)}
          >
            ‹ Previous
          </button>
          <span className="num">
            {formatNumber(page.from + 1)}–{formatNumber(page.to)} of {formatNumber(sorted.length)}
          </span>
          <button
            type="button"
            className={toolButton}
            disabled={page.index >= page.count - 1}
            onClick={() => setPageIndex(page.index + 1)}
          >
            Next ›
          </button>
        </nav>
      ) : null}
    </div>
  );
}
