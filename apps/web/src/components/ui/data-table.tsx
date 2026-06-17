import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
  density?: 'comfortable' | 'compact';
  loading?: boolean;
  empty?: React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectedChange,
  density = 'comfortable',
  loading = false,
  empty,
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const allIds = sortedRows.map(getRowId);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = selectable && selectedIds.length > 0 && !allSelected;

  const toggleAll = () => onSelectedChange?.(allSelected ? [] : allIds);
  const toggleOne = (id: string) =>
    onSelectedChange?.(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5';

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      aria-busy={loading || undefined}
    >
      {loading && <span className="sr-only" role="status">Loading…</span>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="data-table-header">
              {selectable && (
                <th className={cn('w-10', cellPad)}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(cellPad, alignClass[col.align ?? 'left'], col.headerClassName)}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  {selectable && <td className={cellPad}><Skeleton className="h-3.5 w-3.5" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className={cellPad}><Skeleton className="h-4 w-24" /></td>
                  ))}
                </tr>
              ))
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-14 text-center text-sm text-muted-foreground">
                  {empty ?? 'No records found.'}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => {
                const id = getRowId(row);
                const selected = selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'data-table-row data-table-row-enter',
                      onRowClick && 'cursor-pointer',
                      selected && 'bg-primary/[0.04]',
                    )}
                    // Cap the cascade so long tables don't stagger endlessly.
                    style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                  >
                    {selectable && (
                      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                          checked={selected}
                          onChange={() => toggleOne(id)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn(cellPad, alignClass[col.align ?? 'left'], col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
