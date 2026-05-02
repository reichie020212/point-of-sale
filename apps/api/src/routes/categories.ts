/**
 * Categories — list, create, rename, delete.
 *
 * Soft delete only: setting `deletedAt` keeps the row available for sync
 * tombstones for 30 days (HANDOFF §4).
 */
import { categories } from '@counter/schema';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';


const CreateCategoryBody = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().nonnegative().default(0),
});

const PatchCategoryBody = CreateCategoryBody.partial();

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/categories', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const db = getDb();
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, org.id), isNull(categories.deletedAt)))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return reply.send({ categories: rows });
  });

  app.post(
    '/api/v1/categories',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = CreateCategoryBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const inserted = await db
        .insert(categories)
        .values({ orgId: org.id, ...parsed.data })
        .returning();
      const row = inserted[0];
      if (!row) return reply.code(500).send({ error: 'insert_failed' });
      return reply.code(201).send({ category: row });
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/api/v1/categories/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = PatchCategoryBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const updated = await db
        .update(categories)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(categories.id, request.params.id), eq(categories.orgId, org.id)))
        .returning();
      const row = updated[0];
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return reply.send({ category: row });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/categories/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const updated = await db
        .update(categories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(categories.id, request.params.id), eq(categories.orgId, org.id)))
        .returning({ id: categories.id });
      if (updated.length === 0) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
  void gt; // silence unused-import warnings during W2 scaffolding
};
