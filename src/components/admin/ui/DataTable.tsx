import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  numeric?: boolean;
  className?: string;
  width?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T, i: number) => string | number;
  pageSize?: number;
  density?: 'comfortable' | 'compact';
  onDensityChange?: (d: 'comfortable' | 'compact') => void;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  zebra?: boolean;
  hideFooter?: boolean;
}

export function DataTable<T>({
  data, columns, rowKey, pageSize = 10, density: densityProp,
  onDensityChange, loading, empty, onRowClick, zebra = true, hideFooter,
}: Props<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = React.useState(0);
  const [internalDensity, setInternalDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const density = densityProp ?? internalDensity;
  const setDensity = (d: 'comfortable' | 'compact') => {
    onDensityChange ? onDensityChange(d) : setInternalDensity(d);
  };

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const arr = [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const rowPad = density === 'compact' ? 'py-2' : 'py-3';

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return (
    <div className="w-full">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 border-b border-border">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider select-none',
                      c.numeric ? 'text-right' : 'text-left',
                      c.sortable && 'cursor-pointer hover:text-foreground',
                      c.className
                    )}
                    onClick={() => c.sortable && toggleSort(c.key)}
                  >
                    <span className={cn('inline-flex items-center gap-1', c.numeric && 'justify-end w-full')}>
                      {c.header}
                      {c.sortable && (
                        sort?.key === c.key
                          ? sort.dir === 'asc'
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                          : <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4', rowPad)}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    {empty ?? <span className="text-sm text-muted-foreground">No results</span>}
                  </td>
                </tr>
              ) : (
                paged.map((row, i) => (
                  <tr
                    key={rowKey(row, i)}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border last:border-0 transition-colors',
                      zebra && i % 2 === 1 && 'bg-muted/20',
                      onRowClick && 'cursor-pointer hover:bg-muted/40'
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 text-foreground',
                          rowPad,
                          c.numeric && 'text-right tabular-nums',
                          c.className
                        )}
                      >
                        {c.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Density</span>
          <Select value={density} onValueChange={(v) => setDensity(v as 'comfortable' | 'compact')}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">
            {sorted.length === 0
              ? 'Showing 0 of 0'
              : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)} of ${sorted.length}`}
          </span>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-2"
              disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" />Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2"
              disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
