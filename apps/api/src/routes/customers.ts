/**
 * Customers — list / create / update / search.
 *
 * Loyalty defaults per master Blueprint §6: 1% cashback as points.
 * The earn rate is hardcoded here today — TODO(policy-loyalty) when
 * the loyalty model is locked, move it to org-level config and
 * promote loyaltyPoints to a movements ledger so balances are
 * auditable.
 */
import { customers } from '@counter/schema';
import { and, asc, eq, gt, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const CreateCustomerBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().min(4).max(40).optional(),
});

const PatchCustomerBody = CreateCustomerBody.extend({
  loyaltyPoints: z.number().int().min(0).optional(),
}).partial();

const ListQuery = z.object({
  q: z.string().trim().min(1).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/customers', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.issues });
    }
    const { q, cursor, limit } = parsed.data;
    const db = getDb();

    const conditions = [eq(customers.orgId, org.id), isNull(customers.deletedAt)];
    if (cursor) conditions.push(gt(customers.id, cursor));
    if (q) {
      const term = `%${q}%`;
      const search = or(
        ilike(customers.name, term),
        ilike(customers.email, term),
        ilike(customers.phone, term),
      );
      if (search) conditions.push(search);
    }

    const rows = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(asc(customers.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return reply.send({
      customers: page,
      nextCursor: hasMore && last ? last.id : null,
    });
  });

  app.post('/api/v1/customers', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = CreateCustomerBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const db = getDb();
    const inserted = await db
      .insert(customers)
      .values({ orgId: org.id, ...parsed.data })
      .returning();
    const row = inserted[0];
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    return reply.code(201).send({ customer: row });
  });

  app.patch<{ Params: { id: string } }>('/api/v1/customers/:id', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = PatchCustomerBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const db = getDb();
    const updated = await db
      .update(customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(customers.id, request.params.id),
          eq(customers.orgId, org.id),
          isNull(customers.deletedAt),
        ),
      )
      .returning();
    const row = updated[0];
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ customer: row });
  });
};
