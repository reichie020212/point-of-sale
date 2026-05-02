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
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { getActiveOrg, requireActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';
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
  region: z.enum(['US', 'EU']),
  timezone: Timezone.optional(),
});

const PatchOrgBody = z
  .object({
    timezone: Timezone.optional(),
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

    const inserted = await db
      .insert(organizations)
      .values({
        clerkOrgId: clerkOrg.id,
        name,
        slug,
        region: region satisfies Region,
        ...(timezone ? { timezone } : {}),
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      return reply.code(500).send({ error: 'insert_failed', message: 'Org row not returned' });
    }

    await db
      .update(users)
      .set({ activeOrgId: row.id, updatedAt: new Date() })
      .where(eq(users.clerkUserId, request.auth.userId));

    return reply.code(201).send({ org: row });
  });

  app.patch('/api/v1/orgs/active', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = PatchOrgBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const db = getDb();
    const [updated] = await db
      .update(organizations)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(organizations.id, org.id))
      .returning();
    if (!updated) return reply.code(500).send({ error: 'update_failed' });
    return reply.send({ org: updated });
  });
};
