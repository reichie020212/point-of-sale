/**
 * useOrders — observe the local Watermelon orders and re-emit on
 * change. Sorted newest-first so the history screen reflects the most
 * recent sales without scrolling.
 *
 * Variants of this hook (per-day filter, by-cashier, etc.) can subset
 * the same observable later. For now we hand back the full list.
 */
import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../db';

import type { Order as OrderModel } from '../db/models/Order';

export interface OrderSummary {
  id: string;
  clientOpId: string;
  totalCents: number;
  paymentMethod: string;
  status: string;
  createdAtMs: number;
  syncedAtMs: number | null;
}

export function useOrders(limit = 50) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collection = database.get<OrderModel>('orders');
    const sub = collection
      .query(Q.sortBy('created_at', Q.desc), Q.take(limit))
      .observeWithColumns(['status', 'synced_at', 'total_cents'])
      .subscribe((rows) => {
        setOrders(
          rows.map<OrderSummary>((o) => ({
            id: o.serverId,
            clientOpId: o.clientOpId,
            totalCents: o.totalCents,
            paymentMethod: o.paymentMethod,
            status: o.status,
            createdAtMs: o.createdAtMs,
            syncedAtMs: o.syncedAt,
          })),
        );
        setLoading(false);
      });
    return () => sub.unsubscribe();
  }, [limit]);

  return { orders, loading };
}
