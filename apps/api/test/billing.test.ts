/**
 * Pure unit test for the Stripe webhook event-to-side-effects mapper.
 *
 * `mapWebhookEvent` is the core state machine for tier transitions.
 * Tests construct minimal Stripe.Event objects directly so they don't
 * depend on a live Stripe sandbox or DB.
 *
 * Signature verification, raw-body capture, and DB application are
 * exercised end-to-end in a future integration test once a Stripe
 * fixture-replay harness lands.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { priceIdToTier } from '../src/billing/stripe.js';
import { mapWebhookEvent, shouldApplyEvent } from '../src/billing/webhook.js';

import type Stripe from 'stripe';

const PRO_PRICE = 'price_test_pro';
const BUSINESS_PRICE = 'price_test_business';
const CFG = { proPriceId: PRO_PRICE, businessPriceId: BUSINESS_PRICE };

function subscriptionEvent(opts: {
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted';
  priceId: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  orgId?: string;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: number;
}): Stripe.Event {
  const sub: Partial<Stripe.Subscription> = {
    id: opts.subscriptionId ?? 'sub_test_1',
    customer: opts.customerId ?? 'cus_test_1',
    status: opts.status as Stripe.Subscription.Status,
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    current_period_end: opts.currentPeriodEnd ?? 1_700_000_000,
    metadata: opts.orgId ? { orgId: opts.orgId } : {},
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test_1',
          object: 'subscription_item',
          price: { id: opts.priceId } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
  };
  return {
    id: 'evt_test_1',
    type: opts.type,
    data: { object: sub as Stripe.Subscription },
  } as Stripe.Event;
}

function invoiceEvent(): Stripe.Event {
  return {
    id: 'evt_test_invoice_1',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_1',
        customer: 'cus_test_1',
      } as Stripe.Invoice,
    },
  } as Stripe.Event;
}

test('priceIdToTier maps configured prices', () => {
  assert.equal(priceIdToTier(PRO_PRICE, CFG), 'pro');
  assert.equal(priceIdToTier(BUSINESS_PRICE, CFG), 'business');
  assert.equal(priceIdToTier('price_unknown', CFG), null);
  assert.equal(priceIdToTier(PRO_PRICE, { proPriceId: undefined, businessPriceId: undefined }), null);
});

test('subscription.created with pro price → kind=subscription, paid tier', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.created', priceId: PRO_PRICE, status: 'active', orgId: 'org_1' }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.tier, 'pro');
  assert.equal(out.targetOrgTier, 'pro');
  assert.equal(out.orgId, 'org_1');
  assert.equal(out.status, 'active');
  assert.equal(out.cancelAtPeriodEnd, false);
});

test('subscription.created with business price → tier=business', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.created', priceId: BUSINESS_PRICE, status: 'active' }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.tier, 'business');
  assert.equal(out.targetOrgTier, 'business');
});

test('subscription.deleted → targetOrgTier=free (downgrade now)', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.deleted', priceId: PRO_PRICE, status: 'canceled' }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.targetOrgTier, 'free');
});

test('subscription.updated past_due → still on paid tier (within dunning)', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.updated', priceId: PRO_PRICE, status: 'past_due' }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.targetOrgTier, 'pro');
  assert.equal(out.status, 'past_due');
});

test('subscription.updated cancel_at_period_end=true active → still paid', () => {
  // The user has clicked cancel in the portal but hasn't reached the
  // period end yet. They keep their tier; the deletion event fires
  // at period end and downgrades then.
  const out = mapWebhookEvent(
    subscriptionEvent({
      type: 'customer.subscription.updated',
      priceId: PRO_PRICE,
      status: 'active',
      cancelAtPeriodEnd: true,
    }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.targetOrgTier, 'pro');
  assert.equal(out.cancelAtPeriodEnd, true);
});

test('subscription.created with unconfigured price → ignored', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.created', priceId: 'price_random', status: 'active' }),
    CFG,
  );
  assert.equal(out.kind, 'ignored');
});

test('subscription.updated unpaid status → downgrade to free', () => {
  const out = mapWebhookEvent(
    subscriptionEvent({ type: 'customer.subscription.updated', priceId: PRO_PRICE, status: 'unpaid' }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.equal(out.targetOrgTier, 'free');
});

test('invoice.payment_failed → audit (no DB write)', () => {
  const out = mapWebhookEvent(invoiceEvent(), CFG);
  assert.equal(out.kind, 'audit');
  if (out.kind !== 'audit') return;
  assert.equal(out.eventType, 'invoice.payment_failed');
  assert.equal(out.stripeCustomerId, 'cus_test_1');
});

test('unknown event type → ignored', () => {
  const evt = { id: 'evt_x', type: 'customer.created', data: { object: {} } } as unknown as Stripe.Event;
  assert.equal(mapWebhookEvent(evt, CFG).kind, 'ignored');
});

test('shouldApplyEvent — first-ever event applies', () => {
  const decision = shouldApplyEvent({ id: 'evt_1', created: 1_700_000_000 }, null);
  assert.equal(decision, 'apply');
});

test('shouldApplyEvent — same event id is a duplicate', () => {
  const decision = shouldApplyEvent(
    { id: 'evt_1', created: 1_700_000_000 },
    { lastEventId: 'evt_1', lastEventAt: new Date(1_700_000_000 * 1000) },
  );
  assert.equal(decision, 'duplicate');
});

test('shouldApplyEvent — older event is out_of_order', () => {
  // Existing row last applied event from t=2000; new event is from t=1000.
  const decision = shouldApplyEvent(
    { id: 'evt_2', created: 1_700_000_000 },
    { lastEventId: 'evt_1', lastEventAt: new Date(1_800_000_000 * 1000) },
  );
  assert.equal(decision, 'out_of_order');
});

test('shouldApplyEvent — newer event applies', () => {
  const decision = shouldApplyEvent(
    { id: 'evt_2', created: 1_800_000_000 },
    { lastEventId: 'evt_1', lastEventAt: new Date(1_700_000_000 * 1000) },
  );
  assert.equal(decision, 'apply');
});

test('shouldApplyEvent — same-instant event with different id applies', () => {
  // Edge case: two events with identical `created` (rare but possible —
  // Stripe emits multiple events on a single state change). Different
  // id → not a duplicate; same created → not strictly newer. We chose
  // ">=" for ordering so this lands as out_of_order, which is the
  // safer side because the FIRST event with that timestamp already
  // brought us to a consistent state.
  const decision = shouldApplyEvent(
    { id: 'evt_2', created: 1_700_000_000 },
    { lastEventId: 'evt_1', lastEventAt: new Date(1_700_000_000 * 1000) },
  );
  assert.equal(decision, 'out_of_order');
});

test('shouldApplyEvent — null lastEventAt allows apply on resub', () => {
  // Schema lets lastEventAt be null while lastEventId is also null
  // (initial state) but never the other way around. This case
  // exercises a defensive path.
  const decision = shouldApplyEvent(
    { id: 'evt_2', created: 1_800_000_000 },
    { lastEventId: null, lastEventAt: null },
  );
  assert.equal(decision, 'apply');
});

test('subscription.created converts unix timestamp to Date', () => {
  const epoch = 1_700_000_000;
  const out = mapWebhookEvent(
    subscriptionEvent({
      type: 'customer.subscription.created',
      priceId: PRO_PRICE,
      status: 'active',
      currentPeriodEnd: epoch,
    }),
    CFG,
  );
  assert.equal(out.kind, 'subscription');
  if (out.kind !== 'subscription') return;
  assert.ok(out.currentPeriodEnd instanceof Date);
  assert.equal(out.currentPeriodEnd?.getTime(), epoch * 1000);
});
