/**
 * Auth-related REST routes.
 *
 * - POST /api/v1/auth/sync — idempotent upsert of the local `users`
 *   row from the Clerk identity. Called by the web app on first
 *   sign-in (and as a webhook fallback later).
 * - GET  /api/v1/users — list teammates in the active org for the
 *   dashboard's Set-PIN form.
 * - PUT  /api/v1/users/:id/pin — set/clear a user's mobile PIN.
 *   Bumps the org's currentVersion + the user row's version so the
 *   change syncs to mobile devices on next PULL. Owner/manager only.
 */
import { organizations, users, type Db } from '@counter/schema';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { hashPin, isValidPin } from '../auth/pin-hash.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const SetPinBody = z.object({
  /** 4-digit PIN. Pass null to clear the PIN (locks the user out of
   *  the mobile register). */
  pin: z.union([z.string(), z.null()]),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/v1/auth/sync', async (request, reply) => {
    const db = getDb();
    const { userId } = request.auth;

    const clerkUser = await app.clerk.users.getUser(userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) {
      return reply.code(400).send({
        error: 'missing_email',
        message: 'Clerk user has no primary email address',
      });
    }
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null;

    const [row] = await db
      .insert(users)
      .values({ clerkUserId: userId, email, name })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { email, name, updatedAt: new Date() },
      })
      .returning();

    return reply.send({ user: row });
  });

  app.get('/api/v1/users', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        hasPin: sql<boolean>`${users.pinHash} IS NOT NULL`,
      })
      .from(users)
      .where(and(eq(users.activeOrgId, org.id), isNull(users.deletedAt)))
      .orderBy(asc(users.email));
    return reply.send({ users: rows });
  });

  app.put<{ Params: { id: string } }>(
    '/api/v1/users/:id/pin',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = SetPinBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const { pin } = parsed.data;
      if (pin !== null && !isValidPin(pin)) {
        return reply.code(400).send({
          error: 'invalid_pin',
          message: 'PIN must be exactly 4 digits.',
        });
      }
      const db = getDb();
      const updated = await db.transaction(async (tx: Db) => {
        const [bumped] = await tx
          .update(organizations)
          .set({ currentVersion: sql`${organizations.currentVersion} + 1` })
          .where(eq(organizations.id, org.id))
          .returning({ currentVersion: organizations.currentVersion });
        if (!bumped) throw new Error('org not found');
        const pinHash = pin === null ? null : hashPin(request.params.id, pin);
        const [row] = await tx
          .update(users)
          .set({
            pinHash,
            version: bumped.currentVersion,
            updatedAt: new Date(),
          })
          .where(and(eq(users.id, request.params.id), eq(users.activeOrgId, org.id)))
          .returning({ id: users.id });
        return row;
      });
      if (!updated) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
};
