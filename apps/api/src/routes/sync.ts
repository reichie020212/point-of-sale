/**
 * Sync engine health.
 *
 * One read endpoint at `GET /api/v1/sync/status`. Aggregates per-device
 * sync state for the active org so the dashboard's Registers page (and
 * future on-call dashboards) can answer "is this register up to date?"
 * without raw SQL.
 *
 * Response shape:
 *   {
 *     orgVersion: string,           // current_version on the org row
 *     queuedOps: number,            // sync_idempotency rows in TTL window
 *     devices: [
 *       { id, name, status, lastSeenAt, lastSeenVersion, lag, lastIp,
 *         freshness: 'live' | 'stale' | 'offline' }
 *     ],
 *   }
 *
 * Lag = orgVersion - device.lastSeenVersion. `freshness` derives from
 * lastSeenAt: live (<60s), stale (<10m), offline (older / never).
 *
 * Tier-gated to pro/business since sync itself is.
 */
import { devices, organizations, syncIdempotency, type Device } from '@counter/schema';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { requireActiveOrg } from '../auth/org.js';
import { requireTier } from '../auth/tier.js';
import { getDb } from '../db.js';
import { IDEMPOTENCY_TTL_MS } from '../sync/maintenance.js';

import type { FastifyPluginAsync } from 'fastify';

const LIVE_THRESHOLD_MS = 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

type Freshness = 'live' | 'stale' | 'offline';

function freshnessOf(lastSeenAt: Date | null, now: Date): Freshness {
  if (!lastSeenAt) return 'offline';
  const age = now.getTime() - lastSeenAt.getTime();
  if (age <= LIVE_THRESHOLD_MS) return 'live';
  if (age <= STALE_THRESHOLD_MS) return 'stale';
  return 'offline';
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/v1/sync/status',
    { preHandler: requireTier(['pro', 'business']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const now = new Date();

      const [orgRow] = await db
        .select({ currentVersion: organizations.currentVersion })
        .from(organizations)
        .where(eq(organizations.id, org.id))
        .limit(1);
      const orgVersion = orgRow?.currentVersion ?? 0n;

      const queueWindowStart = new Date(now.getTime() - IDEMPOTENCY_TTL_MS);
      const [queuedAgg] = await db
        .select({ n: sql<string>`count(*)` })
        .from(syncIdempotency)
        .where(
          and(
            eq(syncIdempotency.orgId, org.id),
            gt(syncIdempotency.processedAt, queueWindowStart),
          ),
        );
      const queuedOps = Number(queuedAgg?.n ?? 0);

      const rows = await db
        .select()
        .from(devices)
        .where(and(eq(devices.orgId, org.id), isNull(devices.deletedAt)));

      const devicesOut = rows
        .map((d: Device) => {
          const lag = orgVersion - d.lastSeenVersion;
          return {
            id: d.id,
            name: d.name,
            status: d.status,
            lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
            lastSeenVersion: d.lastSeenVersion.toString(),
            lag: lag < 0n ? '0' : lag.toString(),
            lastIp: d.lastIp,
            freshness: freshnessOf(d.lastSeenAt, now),
          };
        })
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

      return reply.send({
        orgVersion: orgVersion.toString(),
        queuedOps,
        devices: devicesOut,
      });
    },
  );
};
