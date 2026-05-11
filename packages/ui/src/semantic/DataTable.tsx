import * as React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Layer-4 data table. Wraps the shadcn `Table*` atoms with a
 * declarative columns + rows API so feature pages stop hand-rolling
 * `<table>` markup and column tuples stay collocated with their cell
 * renderers.
 *
 * For richer needs (sorting / filtering / pagination) compose
 * `@tanstack/react-table` with this same surface — adding a follow-up
 * `useTable()` hook later won't break callers that only need the
 * declarative API today.
 */

export type DataTableAlignment = 'start' | 'center' | 'end';

export interface DataTableColumn<Row> {
  id: string;
  header: React.ReactNode;
  cell: (row: Row, rowIndex: number) => React.ReactNode;
  align?: DataTableAlignment;
  /** Optional CSS width string (e.g. `"12rem"`, `"40%"`). */
  width?: string;
  /**
   * `'strong'` renders the cell with `font-medium`, the canonical
   * shadcn first-column treatment. `'muted'` lowers contrast for
   * secondary metadata (timestamps, ids, etc.). Defaults to `normal`.
   */
  emphasis?: 'normal' | 'strong' | 'muted';
  /** Hide the header label visually but keep it for screen readers. */
  srOnlyHeader?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  keyAccessor: (row: Row, index: number) => React.Key;
  /** Rendered when `rows.length === 0`; usually an `<EmptyState>`. */
  empty?: React.ReactNode;
  /**
   * Per-row click handler — when set the row gets cursor + hover styles
   * and Enter/Space keyboard activation. Skip when rows already have
   * an inline link cell (e.g. an "Open" button).
   */
  onRowClick?: (row: Row) => void;
  className?: string;
  caption?: React.ReactNode;
}

const ALIGN_CLASS: Record<DataTableAlignment, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

const EMPHASIS_CLASS: Record<NonNullable<DataTableColumn<unknown>['emphasis']>, string> = {
  normal: '',
  strong: 'font-medium',
  muted: 'text-muted-foreground',
};

export function DataTable<Row>({
  columns,
  rows,
  keyAccessor,
  empty,
  onRowClick,
  className,
  caption,
}: DataTableProps<Row>): React.ReactElement {
  if (rows.length === 0 && empty != null) {
    return <>{empty}</>;
  }
  return (
    <Table className={className}>
      {caption != null ? <caption className="sr-only">{caption}</caption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.id}
              className={cn(col.align ? ALIGN_CLASS[col.align] : undefined, col.headerClassName)}
              style={col.width ? { width: col.width } : undefined}
            >
              {col.srOnlyHeader ? <span className="sr-only">{col.header}</span> : col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow
            key={keyAccessor(row, rowIndex)}
            data-clickable={onRowClick ? 'true' : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <TableCell
                key={col.id}
                className={cn(
                  col.align ? ALIGN_CLASS[col.align] : undefined,
                  col.emphasis ? EMPHASIS_CLASS[col.emphasis] : undefined,
                  col.cellClassName,
                )}
              >
                {col.cell(row, rowIndex)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
