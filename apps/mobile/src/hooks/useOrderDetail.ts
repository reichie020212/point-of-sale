/**
 * useOrderDetail — observe a single order + its items + cumulative
 * refund total, keyed by the server id (= the original clientOpId for
 * orders we created locally).
 *
 * Reactive: a server-issued refund EVENT updates this hook's output
 * without a manual reload, so the order detail screen reflects the new
 * status the moment the broker fans the change out.
 */
import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../db';

import type { Order as OrderModel } from '../db/models/Order';
import type { OrderItem as OrderItemModel } from '../db/models/OrderItem';
import type { Refund as RefundModel } from '../db/models/Refund';

export interface OrderDetailLine {
  id: string;
  variantId: string;
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiersJson: string | null;
}

export interface PriorRefundsTotals {
  /** Σ refunds.amount_cents — net cash returned so far. */
  amountCents: number;
  /** Σ refunds.subtotal_cents — line-item value already refunded. */
  subtotalCents: number;
  /** Σ refunds.tax_cents — tax already refunded; the next refund's
   *  pro-rate uses (order.tax − this) as the remaining pool. */
  taxCents: number;
  /** Σ refunds.tip_cents — should be 0 until the closing-out refund. */
  tipCents: number;
  /** Σ refunds.discount_cents — discount already reversed. */
  discountCents: number;
  /** `{ [orderItemId]: Σ qty }` aggregated across this order's
   *  refunds. Drives `availableQty` so the refund screen caps each
   *  line's stepper at remaining units. */
  lineQtys: Record<string, number>;
}

export interface OrderDetail {
  id: string;
  status: string;
  paymentMethod: string;
  customerId: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  createdAtMs: number;
  syncedAtMs: number | null;
  items: OrderDetailLine[];
  /** Sum of `amount_cents` over all locally-known refunds for the order.
   *  Kept for backwards compatibility with existing callers; new callers
   *  should use `priorRefunds.amountCents`. */
  refundedCents: number;
  /** Per-component breakdown sums across all prior refunds — feeds into
   *  computeRefundBreakdown's closing-out math. */
  priorRefunds: PriorRefundsTotals;
}

export function useOrderDetail(orderServerId: string | undefined) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderServerId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let itemsSub: { unsubscribe(): void } | null = null;
    let refundsSub: { unsubscribe(): void } | null = null;

    const orderCol = database.get<OrderModel>('orders');
    const itemsCol = database.get<OrderItemModel>('order_items');
    const refundsCol = database.get<RefundModel>('refunds');

    const orderSub = orderCol
      .query(Q.where('server_id', orderServerId), Q.take(1))
      .observeWithColumns(['status', 'total_cents', 'synced_at'])
      .subscribe((rows) => {
        if (cancelled) return;
        const order = rows[0];
        if (!order) {
          setDetail(null);
          setLoading(false);
          return;
        }
        // Re-subscribe items + refunds per-order. Cancelling the prior
        // subs is safe because each fires synchronously on subscribe.
        itemsSub?.unsubscribe();
        refundsSub?.unsubscribe();

        itemsSub = itemsCol
          .query(Q.where('order_id', order.serverId))
          .observeWithColumns(['qty', 'unit_price_cents', 'subtotal_cents'])
          .subscribe((itemRows) => {
            if (cancelled) return;
            updateDetail(order, itemRows, refundsCachedTotals);
          });

        refundsSub = refundsCol
          .query(Q.where('order_id', order.serverId))
          .observeWithColumns([
            'amount_cents',
            'subtotal_cents',
            'tax_cents',
            'tip_cents',
            'discount_cents',
            'line_qtys_json',
          ])
          .subscribe((refundRows) => {
            if (cancelled) return;
            const lineQtys: Record<string, number> = {};
            refundsCachedTotals = {
              amountCents: 0,
              subtotalCents: 0,
              taxCents: 0,
              tipCents: 0,
              discountCents: 0,
              lineQtys,
            };
            for (const r of refundRows) {
              refundsCachedTotals.amountCents += r.amountCents;
              refundsCachedTotals.subtotalCents += r.subtotalCents ?? 0;
              refundsCachedTotals.taxCents += r.taxCents ?? 0;
              refundsCachedTotals.tipCents += r.tipCents ?? 0;
              refundsCachedTotals.discountCents += r.discountCents ?? 0;
              const parsed = parseLineQtys(r.lineQtysJson);
              for (const [lineId, qty] of Object.entries(parsed)) {
                lineQtys[lineId] = (lineQtys[lineId] ?? 0) + qty;
              }
            }
            updateDetail(order, lastItems, refundsCachedTotals);
          });
      });

    let lastItems: OrderItemModel[] = [];
    let refundsCachedTotals: PriorRefundsTotals = {
      amountCents: 0,
      subtotalCents: 0,
      taxCents: 0,
      tipCents: 0,
      discountCents: 0,
      lineQtys: {},
    };

    function updateDetail(
      order: OrderModel,
      items: OrderItemModel[],
      priorRefunds: PriorRefundsTotals,
    ) {
      lastItems = items;
      setDetail({
        id: order.serverId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        customerId: order.customerId,
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        tipCents: order.tipCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        createdAtMs: order.createdAtMs,
        syncedAtMs: order.syncedAt,
        items: items.map((it) => ({
          id: it.serverId,
          variantId: it.variantId,
          nameSnapshot: it.nameSnapshot,
          qty: it.qty,
          unitPriceCents: it.unitPriceCents,
          subtotalCents: it.subtotalCents,
          modifiersJson: it.modifiersJson,
        })),
        refundedCents: priorRefunds.amountCents,
        priorRefunds,
      });
      setLoading(false);
    }

    return () => {
      cancelled = true;
      orderSub.unsubscribe();
      itemsSub?.unsubscribe();
      refundsSub?.unsubscribe();
    };
  }, [orderServerId]);

  return { detail, loading };
}

/** Tolerant parser — pre-v6 refund rows have null/empty
 *  `line_qtys_json`; legacy or corrupt JSON degrades to {} so the rest
 *  of the math still works. */
function parseLineQtys(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}
