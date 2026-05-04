/**
 * Orders dashboard — paginated table of every sale.
 *
 * Server-rendered list pulls from `GET /api/v1/orders` with the org's
 * Clerk token. Status pill, total, and refunded amount are visible at
 * a glance; tap a row to drill into the order's items + refund
 * history.
 *
 * Filtering by status (paid / partially_refunded / refunded) is the
 * first cut at a "Refunds" view; deeper analytics live in the existing
 * dashboard reports page.
 */
import Link from 'next/link';

import { api } from '../../../../lib/api';

type OrderStatus = 'paid' | 'partially_refunded' | 'refunded';

interface OrderRow {
  id: string;
  status: OrderStatus;
  paymentMethod: 'cash' | 'card' | 'split' | 'mock';
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  refundedCents: number;
  customerId: string | null;
  createdAt: string;
}

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function statusPill(status: OrderStatus) {
  switch (status) {
    case 'refunded':
      return 'bg-bad/10 text-bad border-bad/20';
    case 'partially_refunded':
      return 'bg-warn/10 text-warn border-warn/20';
    default:
      return 'bg-surface-2 text-ink-2 border-line';
  }
}

function prettyStatus(status: OrderStatus): string {
  switch (status) {
    case 'partially_refunded':
      return 'Partial refund';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Paid';
  }
}

const STATUS_FILTERS: Array<{ value: '' | OrderStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_refunded', label: 'Partial refund' },
  { value: 'refunded', label: 'Refunded' },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = (
    ['paid', 'partially_refunded', 'refunded'] as const
  ).includes(searchParams.status as OrderStatus)
    ? (searchParams.status as OrderStatus)
    : undefined;

  let rows: OrderRow[] = [];
  let error: string | null = null;
  try {
    const res = await api<{ orders: OrderRow[]; nextCursor: string | null }>(
      '/api/v1/orders',
      { query: { limit: 50, status } },
    );
    rows = res.orders;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Orders</h1>
          <p className="mt-1 text-sm text-ink-2">
            {rows.length} order{rows.length === 1 ? '' : 's'}
            {status && ` · ${prettyStatus(status)}`}
          </p>
        </div>
        <nav className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
          {STATUS_FILTERS.map((f) => {
            const active = (status ?? '') === f.value;
            const href = f.value
              ? `/dashboard/orders?status=${f.value}`
              : '/dashboard/orders';
            return (
              <Link
                key={f.value || 'all'}
                href={href}
                className={`rounded px-3 py-1 ${
                  active ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface p-12 text-center text-ink-3">
          No orders yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-2 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-ink-2">Date</th>
                <th className="px-4 py-3 font-medium text-ink-2">Status</th>
                <th className="px-4 py-3 font-medium text-ink-2">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-ink-2">Total</th>
                <th className="px-4 py-3 text-right font-medium text-ink-2">Refunded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-line last:border-b-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-mono tabular text-ink-2">
                    <Link
                      href={`/dashboard/orders/${o.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {fmtDate(o.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusPill(o.status)}`}
                    >
                      {prettyStatus(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2 capitalize">{o.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-mono tabular text-ink">
                    {fmtMoney(o.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular text-bad">
                    {o.refundedCents > 0 ? `−${fmtMoney(o.refundedCents)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
