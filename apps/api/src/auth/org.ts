/**
 * Resolve the active organization for an authenticated request.
 *
 * Strategy:
 *   1. If the JWT carries an `org_id` claim (set by Clerk's
 *      `counter-sync-v1` template) and we have a matching local row,
 *      use it.
 *   2. Otherwise fall back to `users.active_org_id` (set during
 *      onboarding and on org-switching).
 *   3. If neither is set, the user belongs to no org yet → 403.
 *
 * Caches nothing intentionally — orgs and active selections change.
 * If this becomes hot we add a per-request memo, not a cross-request
 * cache.
 */
import { organizations, users, type Organization } from '@counter/schema';
import { eq } from 'drizzle-orm';

import { getDb } from '../db.js';

import type { FastifyReply, FastifyRequest } from 'fastify';



export async function getActiveOrg(request: FastifyRequest): Promise<Organization | null> {
  const db = getDb();
  const { userId, orgId: clerkOrgId } = request.auth;

  if (clerkOrgId) {
    const [byClerkOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);
    if (byClerkOrg) return byClerkOrg;
  }

  const [user] = await db
    .select({ activeOrgId: users.activeOrgId })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);
  if (!user?.activeOrgId) return null;

  const [byActive] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.activeOrgId))
    .limit(1);
  return byActive ?? null;
}

/** Replies 403 if no active org; otherwise returns it. */
export async function requireActiveOrg(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Organization | null> {
  const org = await getActiveOrg(request);
  if (!org) {
    reply.code(403).send({
      error: 'no_active_org',
      message: 'No active organization for this user. Complete onboarding first.',
    });
    return null;
  }
  return org;
}
