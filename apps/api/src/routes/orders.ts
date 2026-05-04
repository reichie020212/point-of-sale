/**
 * Orders — list + detail with refund history.
 *
 * Read-only endpoints for the web dashboard. Mutations happen through
 * the sync push path (orders are append-only at sale time, refunds are
 * new rows referencing the original order).
 *
 * The detail response bundles items + refunds in one payload so the
 * dashboard can render an order page without N round-trips. Refunds
 * carry their breakdown columns so the dashboard can show "tax
 * returned" / "tip released on closing" without recomputing against
 * the original order.
 */
import { orderItems, orders, refunds } from '@counter/schema';
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const ListQuery = z.object({
  /** UUID cursor — strictly-greater than this id, paired with createdAt
   *  desc means callers paginate by passing the last seen id. */
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Filter by sale status — useful for the dashboard's "Refunds" tab. */
  status: z.enum(['paid', 'partially_refunded', 'refunded']).optional(),
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/orders', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.issues });
    }
    const { cursor, limit, status } = parsed.data;
    const db = getDb();

    const conditions = [eq(orders.orgId, org.id), isNull(orders.deletedAt)];
    if (cursor) conditions.push(gt(orders.id, cursor));
    if (status) conditions.push(eq(orders.status, status));

    // Aggregate refund totals in one round-trip so the list view can
    // show "₱X refunded" without a per-row lookup. LEFT JOIN keeps
    // unrefunded orders in the result.
    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        tipCents: orders.tipCents,
        discountCents: orders.discountCents,
        totalCents: orders.totalCents,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        refundedCents: sql<string>`coalesce((
          select sum(${refunds.amountCents})
          from ${refunds}
          where ${refunds.orderId} = ${orders.id} and ${refunds.orgId} = ${orders.orgId}
        ), 0)`,
      })
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt), asc(orders.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return reply.send({
      orders: page.map((r: (typeof rows)[number]) => ({
        ...r,
        // Cast to integer in JS — Postgres' coalesce(sum(...)) returns
        // a numeric string, not a JS number. Drizzle is conservative
        // about lossy bigint casts, so we serialize via Number() once
        // we know the value fits in a JS-safe int (cents totals are
        // billions max for any reasonable shop).
        refundedCents: Number(r.refundedCents),
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasMore && last ? last.id : null,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/orders/:id', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const orderId = request.params.id;
    if (!isUuid(orderId)) {
      return reply.code(400).send({ error: 'invalid_id' });
    }
    const db = getDb();

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.id, orderId), eq(orders.orgId, org.id), isNull(orders.deletedAt)),
      )
      .limit(1);
    if (!order) return reply.code(404).send({ error: 'not_found' });

    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.orgId, org.id)))
      .orderBy(asc(orderItems.createdAt), asc(orderItems.id));

    const refundRows = await db
      .select()
      .from(refunds)
      .where(and(eq(refunds.orderId, orderId), eq(refunds.orgId, org.id)))
      .orderBy(asc(refunds.createdAt), asc(refunds.id));

    return reply.send({
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        deletedAt: order.deletedAt ? order.deletedAt.toISOString() : null,
        version: order.version.toString(10),
      },
      items: items.map((it: (typeof items)[number]) => ({
        ...it,
        createdAt: it.createdAt.toISOString(),
        version: it.version.toString(10),
      })),
      refunds: refundRows.map((r: (typeof refundRows)[number]) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        version: r.version.toString(10),
      })),
    });
  });
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
