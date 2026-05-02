/**
 * Organizations — list + create.
 *
 * `GET  /api/v1/orgs`   → orgs the current user belongs to (Clerk membership).
 * `POST /api/v1/orgs`   → create a Clerk org and mirror it into our DB with
 *                         the chosen region (HANDOFF §5 region pinning).
 *
 * Region pinning is enforced at insert time and never changed: an org's
 * region is the data-residency contract. Moving regions is a separate
 * deferred operation (TODO(open-question): region migration policy).
 */
import { organizations, users, type Region } from '@counter/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getActiveOrg, requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';
import { serializeRow } from '../util/serialize.js';
import { isValidTimezone } from '../util/timezone.js';

import type { FastifyPluginAsync } from 'fastify';


const Timezone = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .refine(isValidTimezone, 'Unknown IANA timezone');

const CreateOrgBody = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'slug must be lowercase alphanumeric/hyphens'),
  region: z.enum(['US', 'EU', 'PH']),
  timezone: Timezone.optional(),
});

/**
 * Tax rate as a percent string with up to three decimals: `0` to
 * `99.999`. Stored on `organizations.tax_rate` (numeric(5,3)) so the
 * mobile cart can do `Math.round(subtotal * (rate / 100))` without
 * losing precision on PH VAT (12.000) or zero-rated exempt sales.
 */
const TaxRate = z
  .string()
  .trim()
  .regex(/^\d{1,2}(\.\d{1,3})?$/, 'Tax rate must be a decimal percent (e.g. 12.000)')
  .refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n < 100;
  }, 'Tax rate must be between 0 and 100');

/** ISO 4217 currency code (uppercase, three letters). */
const Currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code');

const PatchOrgBody = z
  .object({
    timezone: Timezone.optional(),
    taxRate: TaxRate.optional(),
    currency: Currency.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/orgs/active', async (request, reply) => {
    const org = await getActiveOrg(request);
    if (!org) return reply.code(404).send({ error: 'no_active_org' });
    return { org };
  });

  app.get('/api/v1/orgs', async (request) => {
    const db = getDb();
    const memberships = await app.clerk.users.getOrganizationMembershipList({
      userId: request.auth.userId,
    });
    const clerkOrgIds = memberships.data.map((m) => m.organization.id);
    if (clerkOrgIds.length === 0) return { orgs: [] };

    const orgs = await db
      .select()
      .from(organizations)
      .where(inArray(organizations.clerkOrgId, clerkOrgIds));
    return { orgs };
  });

  app.post('/api/v1/orgs', async (request, reply) => {
    const parsed = CreateOrgBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { name, slug, region, timezone } = parsed.data;
    const db = getDb();

    const clerkOrg = await app.clerk.organizations.createOrganization({
      name,
      slug,
      createdBy: request.auth.userId,
    });

    // Region-driven currency/tax defaults. The schema column defaults
    // (PHP / 12.000) reflect §9's PH-only launch; for an explicit
    // US or EU choice we still want sensible bootstraps so an operator
    // doesn't have to immediately PATCH the new org. Owners can refine
    // both fields later from /dashboard/settings.
    const defaults: { currency: string; taxRate: string } =
      region === 'PH'
        ? { currency: 'PHP', taxRate: '12.000' }
        : region === 'US'
          ? { currency: 'USD', taxRate: '0.000' }
          : { currency: 'EUR', taxRate: '0.000' };

    const inserted = await db
      .insert(organizations)
      .values({
        clerkOrgId: clerkOrg.id,
        name,
        slug,
        region: region satisfies Region,
        currency: defaults.currency,
        taxRate: defaults.taxRate,
        ...(timezone ? { timezone } : {}),
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      return reply.code(500).send({ error: 'insert_failed', message: 'Org row not returned' });
    }

    // Org creator is the owner (HANDOFF §9). Subsequent invitees default
    // to cashier — managers will be promoted from cashier in a later
    // Blueprint when team-invite UI lands.
    await db
      .update(users)
      .set({ activeOrgId: row.id, role: 'owner', updatedAt: new Date() })
      .where(eq(users.clerkUserId, request.auth.userId));

    return reply.code(201).send({ org: row });
  });

  app.patch(
    '/api/v1/orgs/active',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = PatchOrgBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      // Bump the org's Lamport clock and stamp the new value on the
      // row's own `version`. Mobile clients with cursor < newVersion
      // will see the update via the next PULL/EVENT; clients already
      // ahead skip it. The two columns can diverge — `currentVersion`
      // moves on every PUSH batch, `version` only when this row
      // changes.
      const [updated] = await db
        .update(organizations)
        .set({
          ...parsed.data,
          currentVersion: sql`${organizations.currentVersion} + 1`,
          version: sql`${organizations.currentVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id))
        .returning();
      if (!updated) return reply.code(500).send({ error: 'update_failed' });
      // Fan out the change so every paired register reactively picks
      // up the new tax rate / currency / timezone without waiting
      // for the next REST refresh. Wire shape mirrors the sync
      // engine's record_updated EVENT (Blueprint #18).
      await app.broker.publish(updated.id, {
        type: 'record_updated',
        orgId: updated.id,
        table: 'organizations',
        id: updated.id,
        version: updated.version.toString(),
        record: serializeRow(updated),
      });
      return reply.send({ org: updated });
    },
  );
};
