/**
 * Role-based authz preHandler.
 *
 * HANDOFF §9 closed 2026-05-03 with three roles:
 *   owner   — everything
 *   manager — everything except billing + team management
 *   cashier — sell + refund only
 *
 * Mount `requireRole(['owner', 'manager'])` after the Clerk plugin and
 * (optionally) before `requireActiveOrg` on any route that mutates
 * catalog, devices, billing, imports, or org settings. Reads do not
 * gate on role — every member of an org can see its catalog and
 * dashboards.
 *
 * Device-token requests are rejected outright: a paired register
 * represents the org but cannot perform admin actions. The dashboard
 * is the only surface that can.
 */
import { users, type UserRole } from '@counter/schema';
import { eq } from 'drizzle-orm';

import { getDb } from '../db.js';

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export function requireRole(allowed: UserRole[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth.deviceOrgId) {
      return reply.code(403).send({
        error: 'role_required',
        message: 'Paired devices cannot perform this action. Use the dashboard.',
        requiredRoles: allowed,
      });
    }
    const db = getDb();
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkUserId, request.auth.userId))
      .limit(1);
    if (!row) {
      return reply.code(403).send({
        error: 'no_user_record',
        message: 'User has no local record. Complete onboarding first.',
      });
    }
    if (!allowed.includes(row.role)) {
      return reply.code(403).send({
        error: 'role_required',
        message: `This action requires ${allowed.join(' or ')}. You're a ${row.role}.`,
        currentRole: row.role,
        requiredRoles: allowed,
      });
    }
  };
}
