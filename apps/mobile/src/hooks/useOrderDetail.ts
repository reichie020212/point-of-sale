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

export interface OrderDetail {
  id: string;
  status: string;
  paymentMethod: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  createdAtMs: number;
  syncedAtMs: number | null;
  items: OrderDetailLine[];
  /** Sum of `amount_cents` over all locally-known refunds for the order. */
  refundedCents: number;
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
            updateDetail(order, itemRows, refundsCachedTotal);
          });

        refundsSub = refundsCol
          .query(Q.where('order_id', order.serverId))
          .observeWithColumns(['amount_cents'])
          .subscribe((refundRows) => {
            if (cancelled) return;
            refundsCachedTotal = refundRows.reduce((sum, r) => sum + r.amountCents, 0);
            updateDetail(order, lastItems, refundsCachedTotal);
          });
      });

    let lastItems: OrderItemModel[] = [];
    let refundsCachedTotal = 0;

    function updateDetail(
      order: OrderModel,
      items: OrderItemModel[],
      refundedCents: number,
    ) {
      lastItems = items;
      setDetail({
        id: order.serverId,
        status: order.status,
        paymentMethod: order.paymentMethod,
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
        refundedCents,
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
