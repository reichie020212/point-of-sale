/**
 * Pure webhook event-to-side-effects mapper.
 *
 * This module deliberately knows nothing about Fastify, the Stripe
 * SDK transport, or signature verification — those live in the route
 * layer. Here we just receive a parsed `Stripe.Event` and return a
 * structured `WebhookOutcome` describing the database side effect.
 *
 * Pure-handler shape lets us:
 *   - unit-test the state machine without booting the API,
 *   - replay raw webhook payloads from Stripe's dashboard at fixture
 *     speed in tests,
 *   - reuse the same logic for a future "reconcile from Stripe"
 *     batch job.
 *
 * Only the events listed in `HANDLED_EVENT_TYPES` mutate state; the
 * webhook route should respond 200 to everything else so Stripe
 * stops retrying.
 */
import { priceIdToTier } from './stripe.js';

import type Stripe from 'stripe';

export const HANDLED_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const;

export interface WebhookConfig {
  proPriceId: string | undefined;
  businessPriceId: string | undefined;
}

/**
 * Discriminated union of side effects the route layer should apply.
 *
 * - `subscription`: Stripe subscription lifecycle event. Upsert the
 *   billing row + flip `organizations.tier` to `targetOrgTier`. The
 *   org id rides on `subscription_data.metadata.orgId` (set during
 *   checkout) so subscription events always know which Counter org
 *   they belong to.
 * - `audit`: Worth logging, no DB write (e.g. payment failure inside
 *   Stripe's normal dunning window — the follow-up
 *   `customer.subscription.updated` carries the new status).
 * - `ignored`: Event type the mapper doesn't act on; the route still
 *   returns 200 so Stripe stops retrying.
 */
export type WebhookOutcome =
  | {
      kind: 'subscription';
      orgId: string | null;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      status: string;
      tier: 'pro' | 'business';
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      targetOrgTier: 'free' | 'pro' | 'business';
    }
  | { kind: 'audit'; eventType: string; stripeCustomerId: string }
  | { kind: 'ignored' };

function ts(value: number | null | undefined): Date | null {
  if (typeof value !== 'number') return null;
  return new Date(value * 1000);
}

function readOrgId(metadata: Stripe.Metadata | null | undefined): string | null {
  if (!metadata) return null;
  return metadata.orgId ?? metadata.org_id ?? null;
}

/**
 * Convert the Stripe subscription `status` plus paid tier into the
 * org tier the org should be on right now.
 *
 * - `active` / `trialing` / `past_due` → paid tier (still inside
 *   Stripe's dunning window for past_due)
 * - everything else (`canceled`, `unpaid`, `incomplete_expired`) →
 *   `free`
 *
 * `cancel_at_period_end` is intentionally NOT a downgrade trigger:
 * the user keeps their tier until period end, at which point Stripe
 * fires `customer.subscription.deleted` and we downgrade then.
 */
function tierForStatus(
  status: string,
  paid: 'pro' | 'business',
): 'free' | 'pro' | 'business' {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return paid;
  return 'free';
}

export function mapWebhookEvent(event: Stripe.Event, cfg: WebhookConfig): WebhookOutcome {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const item = sub.items.data[0];
      if (!item) return { kind: 'ignored' };
      const paid = priceIdToTier(item.price.id, cfg);
      if (!paid) return { kind: 'ignored' };
      return {
        kind: 'subscription',
        orgId: readOrgId(sub.metadata),
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        tier: paid,
        currentPeriodEnd: ts(sub.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        targetOrgTier: tierForStatus(sub.status, paid),
      };
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return { kind: 'ignored' };
      return { kind: 'audit', eventType: event.type, stripeCustomerId: customerId };
    }
    default:
      return { kind: 'ignored' };
  }
}
