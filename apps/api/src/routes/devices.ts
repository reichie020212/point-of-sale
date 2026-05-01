/**
 * Devices — list + revoke.
 *
 * Per master Blueprint §8 step 12: dashboards on registers (M7) need a
 * real list of paired devices. Pairing-flow (POST /pairing) is W5+
 * work; for now this exposes read + revoke so the registers card can
 * stop falling back to an empty state.
 *
 * Tier-gated (pro / business). Free tier orgs get a 402 with a
 * `tier_required` code that the web layout already redirects from.
 */
import { devices } from '@counter/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { requireActiveOrg } from '../auth/org.js';
import { requireTier } from '../auth/tier.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/v1/devices',
    { preHandler: requireTier(['pro', 'business']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const rows = await db
        .select()
        .from(devices)
        .where(and(eq(devices.orgId, org.id), isNull(devices.deletedAt)))
        .orderBy(asc(devices.createdAt));
      return reply.send({ devices: rows });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/devices/:id/revoke',
    { preHandler: requireTier(['pro', 'business']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const [updated] = await db
        .update(devices)
        .set({ status: 'revoked', tokenHash: null, updatedAt: new Date() })
        .where(
          and(
            eq(devices.id, request.params.id),
            eq(devices.orgId, org.id),
            isNull(devices.deletedAt),
          ),
        )
        .returning();
      if (!updated) return reply.code(404).send({ error: 'not_found' });
      return reply.send({ device: updated });
    },
  );
};
