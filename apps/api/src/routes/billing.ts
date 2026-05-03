/**
 * Stripe billing routes.
 *
 *   POST /api/v1/billing/checkout — owner-only; creates a Stripe
 *     Checkout Session for the requested tier and returns its URL
 *     for the browser to redirect to.
 *   POST /api/v1/billing/portal   — owner-only; creates a Stripe
 *     Customer Portal session so the owner can manage / cancel.
 *   POST /api/v1/billing/webhook  — public (signature-gated); Stripe
 *     posts subscription lifecycle events here. Updates
 *     `billing_subscriptions` and flips `organizations.tier`.
 *
 * The webhook route is the source of truth for tier transitions —
 * checkout/portal endpoints don't try to optimistically flip the
 * tier client-side. Stripe is canonical, our DB mirrors it.
 *
 * Design notes:
 *  - The Stripe SDK is lazy-initialized via `getStripe()`. When
 *    `STRIPE_SECRET_KEY` is unset (CI / fresh dev clone), the routes
 *    return 503 with a stable error code so the frontend can surface
 *    a "billing not configured" state instead of a generic 500.
 *  - Webhook signature verification reads `request.rawBody`, which
 *    is supplied by `fastify-raw-body` configured at server bootstrap
 *    to capture the unparsed body for this exact route.
 */
import { billingSubscriptions, organizations, users, type Db } from '@counter/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireRole } from '../auth/role.js';
import { createCheckoutSession, createPortalSession } from '../billing/checkout.js';
import { getStripe } from '../billing/stripe.js';
import { mapWebhookEvent } from '../billing/webhook.js';
import { getDb } from '../db.js';

import type { Config } from '../config.js';
import type { FastifyPluginAsync } from 'fastify';

export interface BillingRouteOptions {
  config: Config;
}

const CheckoutBody = z.object({
  tier: z.enum(['pro', 'business']),
});

export function billingRoutes(opts: BillingRouteOptions): FastifyPluginAsync {
  const { config } = opts;

  return async (app) => {
    app.post('/api/v1/billing/checkout', { preHandler: requireRole(['owner']) }, async (request, reply) => {
      const stripe = getStripe(config.STRIPE_SECRET_KEY);
      if (!stripe) {
        return reply.code(503).send({
          error: 'billing_not_configured',
          message: 'Stripe is not configured on this deployment.',
        });
      }
      const parsed = CheckoutBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const priceId =
        parsed.data.tier === 'pro' ? config.STRIPE_PRICE_PRO : config.STRIPE_PRICE_BUSINESS;
      if (!priceId) {
        return reply.code(503).send({
          error: 'billing_not_configured',
          message: `No Stripe price configured for tier ${parsed.data.tier}.`,
        });
      }

      const db = getDb();
      const [user] = await db
        .select({ activeOrgId: users.activeOrgId })
        .from(users)
        .where(eq(users.clerkUserId, request.auth.userId))
        .limit(1);
      if (!user?.activeOrgId) {
        return reply.code(403).send({ error: 'no_active_org' });
      }
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.activeOrgId))
        .limit(1);
      if (!org) return reply.code(403).send({ error: 'no_active_org' });

      const [existing] = await db
        .select({ stripeCustomerId: billingSubscriptions.stripeCustomerId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.orgId, org.id))
        .limit(1);

      const session = await createCheckoutSession(stripe, {
        orgId: org.id,
        orgName: org.name,
        priceId,
        existingCustomerId: existing?.stripeCustomerId ?? null,
        successUrl: config.BILLING_SUCCESS_URL,
        cancelUrl: config.BILLING_CANCEL_URL,
      });
      if (!session.url) {
        return reply.code(500).send({ error: 'checkout_url_missing' });
      }
      return reply.send({ url: session.url, sessionId: session.id });
    });

    app.post('/api/v1/billing/portal', { preHandler: requireRole(['owner']) }, async (request, reply) => {
      const stripe = getStripe(config.STRIPE_SECRET_KEY);
      if (!stripe) {
        return reply.code(503).send({ error: 'billing_not_configured' });
      }
      const db = getDb();
      const [user] = await db
        .select({ activeOrgId: users.activeOrgId })
        .from(users)
        .where(eq(users.clerkUserId, request.auth.userId))
        .limit(1);
      if (!user?.activeOrgId) {
        return reply.code(403).send({ error: 'no_active_org' });
      }
      const [row] = await db
        .select({ stripeCustomerId: billingSubscriptions.stripeCustomerId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.orgId, user.activeOrgId))
        .limit(1);
      if (!row?.stripeCustomerId) {
        return reply.code(409).send({
          error: 'no_subscription',
          message: 'No Stripe customer linked to this org. Subscribe first.',
        });
      }
      const session = await createPortalSession(stripe, {
        customerId: row.stripeCustomerId,
        returnUrl: config.BILLING_SUCCESS_URL,
      });
      return reply.send({ url: session.url });
    });

    app.post(
      '/api/v1/billing/webhook',
      { config: { rawBody: true } },
      async (request, reply) => {
        const stripe = getStripe(config.STRIPE_SECRET_KEY);
        if (!stripe || !config.STRIPE_WEBHOOK_SECRET) {
          // Without a webhook secret we cannot verify Stripe's HMAC
          // signature — refuse rather than blindly trusting the body.
          return reply.code(503).send({ error: 'billing_not_configured' });
        }
        const signature = request.headers['stripe-signature'];
        if (typeof signature !== 'string') {
          return reply.code(400).send({ error: 'missing_signature' });
        }
        const rawBody = (request as { rawBody?: string | Buffer }).rawBody;
        if (rawBody === undefined) {
          // Should never happen — the route was registered with
          // `config.rawBody = true`. Surface loudly if the bootstrap
          // wiring drifts.
          return reply.code(500).send({ error: 'raw_body_missing' });
        }
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            config.STRIPE_WEBHOOK_SECRET,
          );
        } catch (err) {
          request.log.warn({ err }, 'stripe webhook signature verification failed');
          return reply.code(400).send({ error: 'bad_signature' });
        }

        const outcome = mapWebhookEvent(event, {
          proPriceId: config.STRIPE_PRICE_PRO,
          businessPriceId: config.STRIPE_PRICE_BUSINESS,
        });

        if (outcome.kind === 'ignored') {
          return reply.send({ received: true, applied: false });
        }
        if (outcome.kind === 'audit') {
          request.log.info(
            { eventType: outcome.eventType, customerId: outcome.stripeCustomerId },
            'stripe billing audit event',
          );
          return reply.send({ received: true, applied: false });
        }

        // outcome.kind === 'subscription'
        const db = getDb();
        // Look up the org id either from the event metadata (preferred)
        // or fall back to the existing customer linkage so events that
        // arrive after an org row is rotated still find their target.
        let orgId = outcome.orgId;
        if (!orgId) {
          const [existing] = await db
            .select({ orgId: billingSubscriptions.orgId })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.stripeCustomerId, outcome.stripeCustomerId))
            .limit(1);
          orgId = existing?.orgId ?? null;
        }
        if (!orgId) {
          // No way to identify the Counter org. Acknowledge to stop
          // retries but flag for ops.
          request.log.warn(
            { customerId: outcome.stripeCustomerId, subscriptionId: outcome.stripeSubscriptionId },
            'stripe subscription event without resolvable orgId',
          );
          return reply.send({ received: true, applied: false, reason: 'no_org' });
        }

        await db.transaction(async (tx: Db) => {
          await tx
            .insert(billingSubscriptions)
            .values({
              orgId,
              stripeCustomerId: outcome.stripeCustomerId,
              stripeSubscriptionId: outcome.stripeSubscriptionId,
              status: outcome.status,
              tier: outcome.tier,
              currentPeriodEnd: outcome.currentPeriodEnd,
              cancelAtPeriodEnd: outcome.cancelAtPeriodEnd,
            })
            .onConflictDoUpdate({
              target: billingSubscriptions.orgId,
              set: {
                stripeCustomerId: outcome.stripeCustomerId,
                stripeSubscriptionId: outcome.stripeSubscriptionId,
                status: outcome.status,
                tier: outcome.tier,
                currentPeriodEnd: outcome.currentPeriodEnd,
                cancelAtPeriodEnd: outcome.cancelAtPeriodEnd,
                updatedAt: new Date(),
              },
            });
          await tx
            .update(organizations)
            .set({ tier: outcome.targetOrgTier, updatedAt: new Date() })
            .where(eq(organizations.id, orgId));
        });

        return reply.send({ received: true, applied: true, orgTier: outcome.targetOrgTier });
      },
    );
  };
}
