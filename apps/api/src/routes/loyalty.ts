/**
 * Loyalty programs — REST CRUD for the dashboard.
 *
 * Programs are sync-replicated (mobile picks them up on PULL). Mutations
 * here bump `organizations.current_version` and stamp the program's
 * `version` to the new value, so the next mobile HELLO with a stale
 * cursor sees the change. We don't currently publish a broker EVENT
 * from REST writes — mobile catches up on reconnect.
 *
 * Soft-delete only: archiving sets `status = 'archived'` (and an
 * optional `deleted_at` for tombstone fan-out). Hard delete is not
 * supported because punches reference programs.
 *
 * RBAC: only owner / manager can mutate; cashier can read.
 */
import { loyaltyPrograms, organizations, type Db } from '@counter/schema';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const CreateProgramBody = z.object({
  name: z.string().trim().min(1).max(80),
  targetType: z.enum(['product', 'category']),
  targetId: z.string().uuid(),
  threshold: z.number().int().positive().max(999),
});

const PatchProgramBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  threshold: z.number().int().positive().max(999).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const loyaltyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/loyalty/programs', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const db = getDb();
    const rows = await db
      .select()
      .from(loyaltyPrograms)
      .where(and(eq(loyaltyPrograms.orgId, org.id), isNull(loyaltyPrograms.deletedAt)))
      .orderBy(asc(loyaltyPrograms.name));
    return reply.send({ programs: rows });
  });

  app.post(
    '/api/v1/loyalty/programs',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = CreateProgramBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const inserted = await db.transaction(async (tx: Db) => {
        const [bumped] = await tx
          .update(organizations)
          .set({ currentVersion: sql`${organizations.currentVersion} + 1` })
          .where(eq(organizations.id, org.id))
          .returning({ currentVersion: organizations.currentVersion });
        if (!bumped) throw new Error('org not found');
        const [row] = await tx
          .insert(loyaltyPrograms)
          .values({
            orgId: org.id,
            name: parsed.data.name,
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
            threshold: parsed.data.threshold,
            status: 'active',
            version: bumped.currentVersion,
          })
          .returning();
        return row;
      });
      if (!inserted) return reply.code(500).send({ error: 'insert_failed' });
      return reply.code(201).send({ program: inserted });
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/api/v1/loyalty/programs/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = PatchProgramBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const updated = await db.transaction(async (tx: Db) => {
        const [bumped] = await tx
          .update(organizations)
          .set({ currentVersion: sql`${organizations.currentVersion} + 1` })
          .where(eq(organizations.id, org.id))
          .returning({ currentVersion: organizations.currentVersion });
        if (!bumped) throw new Error('org not found');
        const [row] = await tx
          .update(loyaltyPrograms)
          .set({
            ...parsed.data,
            version: bumped.currentVersion,
            updatedAt: new Date(),
          })
          .where(
            and(eq(loyaltyPrograms.id, request.params.id), eq(loyaltyPrograms.orgId, org.id)),
          )
          .returning();
        return row;
      });
      if (!updated) return reply.code(404).send({ error: 'not_found' });
      return reply.send({ program: updated });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/loyalty/programs/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const archived = await db.transaction(async (tx: Db) => {
        const [bumped] = await tx
          .update(organizations)
          .set({ currentVersion: sql`${organizations.currentVersion} + 1` })
          .where(eq(organizations.id, org.id))
          .returning({ currentVersion: organizations.currentVersion });
        if (!bumped) throw new Error('org not found');
        const [row] = await tx
          .update(loyaltyPrograms)
          .set({
            status: 'archived',
            deletedAt: new Date(),
            version: bumped.currentVersion,
            updatedAt: new Date(),
          })
          .where(
            and(eq(loyaltyPrograms.id, request.params.id), eq(loyaltyPrograms.orgId, org.id)),
          )
          .returning({ id: loyaltyPrograms.id });
        return row;
      });
      if (!archived) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
};
