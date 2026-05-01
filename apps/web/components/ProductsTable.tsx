'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';

import type { ProductRow } from '../lib/api';

const ch = createColumnHelper<ProductRow>();

const columns = [
  ch.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium text-ink">{info.getValue()}</span>,
  }),
  ch.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue();
      return (
        <span
          className={
            status === 'active'
              ? 'rounded-pill bg-accent-soft px-2 py-0.5 text-xs text-accent-deep'
              : 'rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-ink-3'
          }
        >
          {status}
        </span>
      );
    },
  }),
  ch.accessor('description', {
    header: 'Description',
    cell: (info) => <span className="text-ink-2">{info.getValue() ?? '—'}</span>,
  }),
  ch.accessor('updatedAt', {
    header: 'Updated',
    cell: (info) => (
      <span className="font-mono tabular text-xs text-ink-3">
        {new Date(info.getValue()).toLocaleString()}
      </span>
    ),
  }),
];

export function ProductsTable({ data }: { data: ProductRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-surface-2 text-left">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium text-ink-2">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-ink-3">
                No products yet. Create one from the mobile app or POST to /api/v1/products.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
