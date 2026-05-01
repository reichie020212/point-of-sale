/**
 * Tier gating preHandler.
 *
 * Per master Blueprint §8 step 12: paid features (reports, devices,
 * sync) are gated by `organizations.tier`. Mounting `requireTier`
 * after `requireActiveOrg` returns 402 if the org's tier is not in
 * the allow-list, with a stable code clients can branch on.
 *
 * NOTE: HANDOFF §3 says **Free tier requires no account**. The mobile
 * sell flow must therefore not gate on Clerk + tier. We gate the
 * sync WebSocket and the dashboard, not the local sell loop. See
 * docs/blueprints/master-w2-w8.md §6.
 */
import { getActiveOrg } from './org.js';

import type { Tier } from '@counter/schema';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export function requireTier(allowed: Tier[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const org = await getActiveOrg(request);
    if (!org) {
      return reply.code(403).send({
        error: 'no_active_org',
        message: 'No active organization for this user. Complete onboarding first.',
      });
    }
    if (!allowed.includes(org.tier)) {
      return reply.code(402).send({
        error: 'tier_required',
        message: `This feature requires a ${allowed.join(' or ')} plan. You're on ${org.tier}.`,
        currentTier: org.tier,
        requiredTiers: allowed,
      });
    }
  };
}
