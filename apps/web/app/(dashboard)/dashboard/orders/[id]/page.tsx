/**
 * Order detail dashboard page.
 *
 * Pulls from `GET /api/v1/orders/:id` which returns the order, its
 * items, and every refund (with breakdown columns). Refund history
 * renders newest-first with each refund's component breakdown — the
 * tip-allocation Blueprint follow-up made this data shape canonical so
 * the dashboard can answer "where did this customer's ₱X go" without
 * recomputing against the original order.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, api } from '../../../../../lib/api';

interface OrderDetail {
  order: {
    id: string;
    status: 'paid' | 'partially_refunded' | 'refunded';
    paymentMethod: 'cash' | 'card' | 'split' | 'mock';
    subtotalCents: number;
    taxCents: number;
    tipCents: number;
    discountCents: number;
    totalCents: number;
    customerId: string | null;
    cashierId: string | null;
    createdAt: string;
  };
  items: Array<{
    id: string;
    nameSnapshot: string;
    qty: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  refunds: Array<{
    id: string;
    amountCents: number;
    subtotalCents: number;
    taxCents: number;
    tipCents: number;
    discountCents: number;
    reason: string | null;
    processedById: string | null;
    createdAt: string;
  }>;
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

function prettyStatus(status: OrderDetail['order']['status']): string {
  switch (status) {
    case 'partially_refunded':
      return 'Partial refund';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Paid';
  }
}

function statusPill(status: OrderDetail['order']['status']) {
  switch (status) {
    case 'refunded':
      return 'bg-bad/10 text-bad border-bad/20';
    case 'partially_refunded':
      return 'bg-warn/10 text-warn border-warn/20';
    default:
      return 'bg-surface-2 text-ink-2 border-line';
  }
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  let detail: OrderDetail;
  try {
    detail = await api<OrderDetail>(`/api/v1/orders/${params.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { order, items, refunds } = detail;
  const refundedCents = refunds.reduce((sum, r) => sum + r.amountCents, 0);
  const newestFirst = [...refunds].reverse();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/dashboard/orders"
          className="text-sm text-ink-2 hover:text-ink"
        >
          ← Orders
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink">Order</h1>
            <p className="mt-1 font-mono tabular text-sm text-ink-2">
              {fmtDate(order.createdAt)}
            </p>
          </div>
          <span
            className={`inline-block rounded-full border px-3 py-1 text-xs ${statusPill(order.status)}`}
          >
            {prettyStatus(order.status)}
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 text-xs uppercase tracking-wide text-ink-2">
          Items
        </div>
        <table className="w-full text-sm">
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 font-medium text-ink">{it.nameSnapshot}</td>
                <td className="px-4 py-3 text-right font-mono tabular text-ink-2">
                  × {it.qty}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular text-ink">
                  {fmtMoney(it.subtotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <Row label="Subtotal" value={fmtMoney(order.subtotalCents)} />
        {order.discountCents > 0 && (
          <Row label="Discount" value={`−${fmtMoney(order.discountCents)}`} negative />
        )}
        {order.taxCents > 0 && <Row label="Tax" value={fmtMoney(order.taxCents)} />}
        {order.tipCents > 0 && <Row label="Tip" value={fmtMoney(order.tipCents)} />}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="text-base font-semibold text-ink">Total</span>
          <span className="font-mono tabular text-xl text-ink">
            {fmtMoney(order.totalCents)}
          </span>
        </div>
        {refundedCents > 0 && (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-bad">Refunded</span>
            <span className="font-mono tabular text-bad">−{fmtMoney(refundedCents)}</span>
          </div>
        )}
      </section>

      {refunds.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-3 text-xs uppercase tracking-wide text-ink-2">
            Refund history
          </div>
          <ol>
            {newestFirst.map((r) => (
              <li
                key={r.id}
                className="space-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono tabular text-xs text-ink-2">
                    {fmtDate(r.createdAt)}
                  </span>
                  <span className="font-mono tabular text-sm text-bad">
                    {fmtMoney(r.amountCents)}
                  </span>
                </div>
                {(r.taxCents > 0 || r.tipCents > 0 || r.discountCents > 0) && (
                  <div className="text-xs text-ink-3">
                    Items {fmtMoney(r.subtotalCents)}
                    {r.taxCents > 0 && <> · Tax {fmtMoney(r.taxCents)}</>}
                    {r.tipCents > 0 && <> · Tip {fmtMoney(r.tipCents)}</>}
                    {r.discountCents > 0 && <> · Discount −{fmtMoney(r.discountCents)}</>}
                  </div>
                )}
                {r.reason && (
                  <div className="text-sm italic text-ink-2">“{r.reason}”</div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-2">{label}</span>
      <span className={`font-mono tabular ${negative ? 'text-bad' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}
