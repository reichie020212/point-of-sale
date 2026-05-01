/**
 * Devices — list, pair, revoke.
 *
 * Pairing flow (HANDOFF §3):
 *   POST /api/v1/devices/code  (Clerk auth, tier-gated)
 *     → creates a `pending`-status placeholder row with a CNTR-XXXX-XXXX
 *       code and a 5-min TTL. The web /registers screen displays the
 *       code so an operator can hand-enter it on the unpaired phone.
 *   POST /api/v1/devices/pair  (public — pre-auth exchange)
 *     → swaps the code for an opaque device token. The token's SHA-256
 *       hash is the only server-side artifact.
 *   POST /api/v1/devices/:id/revoke (Clerk auth)
 *     → flips status to `revoked` and clears the hash; the next sync
 *       request from that device drops to 401.
 *   GET  /api/v1/devices       (Clerk auth, tier-gated)
 *     → list paired + pending devices for the active org.
 *
 * Free-tier orgs cannot pair devices; the tier middleware emits 402
 * with `tier_required` so the web layout's redirect kicks in.
 */
import { devices, type Device, type DeviceStatus } from '@counter/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import {
  PAIRING_CODE_TTL_MS,
  generateDeviceToken,
  generatePairingCode,
  hashDeviceToken,
} from '../auth/device-token.js';
import { requireActiveOrg } from '../auth/org.js';
import { requireTier } from '../auth/tier.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

declare module '@counter/schema' {
  // The schema's enum lists `live | offline | revoked`; `pending`
  // is a fourth state used while a device row is waiting on its
  // first /pair call. We persist it as the string `pending` against
  // the same column. (The DB column is a Postgres enum and won't
  // accept strings outside its values, so we map `pending` → `offline`
  // at insert time and use `pairingCode != null` as the actual flag.)
}

const PairBody = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CNTR-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Code must look like CNTR-XXXX-XXXX'),
  name: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(80).optional(),
});

const CodeBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

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
        .where(and(eq(devices.orgId, org.id), isNull(devices.deletedAt)));
      // Surface the pairing state explicitly so the dashboard can show
      // "waiting" rows without having to look at expiry timestamps.
      const now = Date.now();
      const decorated = rows.map((d: Device) => ({
        ...d,
        pairingActive:
          d.pairingCode != null && d.pairingExpiresAt != null
            ? d.pairingExpiresAt.getTime() > now
            : false,
      }));
      decorated.sort(
        (a: Device, b: Device) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return reply.send({ devices: decorated });
    },
  );

  app.post(
    '/api/v1/devices/code',
    { preHandler: requireTier(['pro', 'business']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = CodeBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const code = generatePairingCode();
      const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
      const [row] = await db
        .insert(devices)
        .values({
          orgId: org.id,
          name: parsed.data.name ?? 'Unpaired register',
          status: 'offline' satisfies DeviceStatus,
          pairingCode: code,
          pairingExpiresAt: expiresAt,
        })
        .returning();
      if (!row) {
        return reply.code(500).send({ error: 'insert_failed' });
      }
      return reply.code(201).send({
        device: { id: row.id, name: row.name },
        pairing: { code, expiresAt: expiresAt.toISOString(), ttlMs: PAIRING_CODE_TTL_MS },
      });
    },
  );

  app.post('/api/v1/devices/pair', async (request, reply) => {
    const parsed = PairBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const db = getDb();
    const [row] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.pairingCode, parsed.data.code),
          isNull(devices.deletedAt),
        ),
      )
      .limit(1);
    if (!row || !row.pairingExpiresAt || row.pairingExpiresAt.getTime() < Date.now()) {
      return reply.code(404).send({
        error: 'invalid_code',
        message: 'Pairing code unknown or expired. Generate a new one from the dashboard.',
      });
    }
    if (row.tokenHash) {
      // Pairing is one-shot. If the row already has a token, reject.
      return reply.code(409).send({ error: 'code_already_used' });
    }
    const token = generateDeviceToken();
    const tokenHash = hashDeviceToken(token);
    const [updated] = await db
      .update(devices)
      .set({
        name: parsed.data.name ?? row.name,
        model: parsed.data.model ?? row.model,
        status: 'live' satisfies DeviceStatus,
        pairingCode: null,
        pairingExpiresAt: null,
        tokenHash,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devices.id, row.id))
      .returning();
    if (!updated) {
      return reply.code(500).send({ error: 'pair_failed' });
    }
    return reply.send({
      device: {
        id: updated.id,
        name: updated.name,
        model: updated.model,
        orgId: updated.orgId,
      },
      token,
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/devices/:id/revoke',
    { preHandler: requireTier(['pro', 'business']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const [updated] = await db
        .update(devices)
        .set({
          status: 'revoked' satisfies DeviceStatus,
          tokenHash: null,
          pairingCode: null,
          pairingExpiresAt: null,
          updatedAt: new Date(),
        })
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
