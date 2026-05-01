/**
 * Reports — dashboard KPIs + sales-over-time + top items.
 *
 * Single endpoint per HANDOFF §3: server returns the view-shaped payload
 * (already aggregated, in cents) so the dashboard can render without a
 * second round-trip. Buckets are chosen per range:
 *   - today : 1-hour buckets
 *   - 7d    : 1-day buckets
 *   - 30d   : 1-day buckets
 *   - 90d   : 1-day buckets
 *
 * "Net" excludes refunds; "Gross" is order totals before refunds. Both
 * are summed in cents from the orders table — refunds get subtracted
 * from gross to compute net.
 *
 * TODO(timezone): bucketing is in UTC today. Once `organizations.timezone`
 * lands (master Blueprint §4), pass it to date_trunc.
 */
import { orderItems, orders, refunds } from '@counter/schema';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const RangeQuery = z.object({
  range: z.enum(['today', '7d', '30d', '90d']).default('today'),
});

type Range = z.infer<typeof RangeQuery>['range'];

interface Window {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  bucket: 'hour' | 'day';
}

function windowFor(range: Range, now: Date): Window {
  const end = now;
  if (range === 'today') {
    const start = new Date(end);
    start.setUTCHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    const prevStart = new Date(start);
    prevStart.setUTCDate(prevStart.getUTCDate() - 1);
    return { start, end, prevStart, prevEnd, bucket: 'hour' };
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const prevEnd = start;
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);
  return { start, end, prevStart, prevEnd, bucket: 'day' };
}

interface Summary {
  grossCents: number;
  orders: number;
  avgTicketCents: number;
  netCents: number;
}

async function summarize(
  db: ReturnType<typeof getDb>,
  orgId: string,
  start: Date,
  end: Date,
): Promise<Summary> {
  const [orderAgg] = await db
    .select({
      gross: sql<string>`coalesce(sum(${orders.totalCents}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.orgId, orgId),
        isNull(orders.deletedAt),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
      ),
    );
  const [refundAgg] = await db
    .select({ refunded: sql<string>`coalesce(sum(${refunds.amountCents}), 0)` })
    .from(refunds)
    .where(and(eq(refunds.orgId, orgId), gte(refunds.createdAt, start), lt(refunds.createdAt, end)));
  const grossCents = Number(orderAgg?.gross ?? 0);
  const count = Number(orderAgg?.count ?? 0);
  const refundedCents = Number(refundAgg?.refunded ?? 0);
  return {
    grossCents,
    orders: count,
    avgTicketCents: count === 0 ? 0 : Math.round(grossCents / count),
    netCents: grossCents - refundedCents,
  };
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/reports/dashboard', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = RangeQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.issues });
    }
    const { range } = parsed.data;
    const now = new Date();
    const w = windowFor(range, now);
    const db = getDb();

    const [current, previous] = await Promise.all([
      summarize(db, org.id, w.start, w.end),
      summarize(db, org.id, w.prevStart, w.prevEnd),
    ]);

    const bucketSql =
      w.bucket === 'hour'
        ? sql`date_trunc('hour', ${orders.createdAt})`
        : sql`date_trunc('day', ${orders.createdAt})`;

    const series = await db
      .select({
        bucket: sql<string>`${bucketSql}`,
        grossCents: sql<string>`coalesce(sum(${orders.totalCents}), 0)`,
        orders: sql<string>`count(*)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.orgId, org.id),
          isNull(orders.deletedAt),
          gte(orders.createdAt, w.start),
          lt(orders.createdAt, w.end),
        ),
      )
      .groupBy(bucketSql)
      .orderBy(bucketSql);

    const topItems = await db
      .select({
        variantId: orderItems.variantId,
        name: orderItems.nameSnapshot,
        qty: sql<string>`sum(${orderItems.qty})`,
        grossCents: sql<string>`sum(${orderItems.subtotalCents})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.orgId, org.id),
          isNull(orders.deletedAt),
          gte(orders.createdAt, w.start),
          lt(orders.createdAt, w.end),
        ),
      )
      .groupBy(orderItems.variantId, orderItems.nameSnapshot)
      .orderBy(sql`sum(${orderItems.subtotalCents}) desc`)
      .limit(5);

    return reply.send({
      range,
      window: { start: w.start.toISOString(), end: w.end.toISOString(), bucket: w.bucket },
      summary: {
        current,
        previous,
        delta: {
          grossCents: current.grossCents - previous.grossCents,
          orders: current.orders - previous.orders,
          netCents: current.netCents - previous.netCents,
        },
      },
      series: series.map((r: { bucket: unknown; grossCents: unknown; orders: unknown }) => ({
        bucket: typeof r.bucket === 'string' ? r.bucket : new Date(r.bucket as string).toISOString(),
        grossCents: Number(r.grossCents),
        orders: Number(r.orders),
      })),
      topItems: topItems.map(
        (r: { variantId: string; name: string; qty: unknown; grossCents: unknown }) => ({
          variantId: r.variantId,
          name: r.name,
          qty: Number(r.qty),
          grossCents: Number(r.grossCents),
        }),
      ),
    });
  });
};
