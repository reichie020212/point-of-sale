/**
 * POST /api/v1/auth/sync
 *
 * Idempotent upsert of the local `users` row from the Clerk identity. Called
 * by the web app on first sign-in (and as a webhook fallback later) so we
 * have a stable internal user id to FK against.
 */
import { users } from '@counter/schema';

import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';



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
};
