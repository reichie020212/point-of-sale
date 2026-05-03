/**
 * Billing schema — Stripe linkage for paid tiers.
 *
 * One row per organization (the `org_id` column is unique). The row is
 * created the first time an owner runs Stripe Checkout, even if the
 * checkout is later abandoned: at that point we already have a Stripe
 * customer id we should reuse for portal sessions and future upgrades.
 *
 * The row also tracks the *latest* subscription's lifecycle fields. A
 * Stripe customer can have many subscriptions over time (cancel + resub,
 * plan change after a cancellation, etc.); for v1 we keep the most
 * recent one in-place because the dashboard only ever needs to show
 * "is this org currently paying, and when does the period end". A
 * dedicated audit log can land later if we ever need full subscription
 * history beyond what Stripe itself stores.
 *
 * `tier` mirrors the price id the customer purchased so the webhook
 * handler can flip `organizations.tier` based on which plan the latest
 * sub belongs to. Free orgs have no row in this table.
 *
 * Intentionally out of `SYNC_TABLES`: stripe ids and billing state are
 * dashboard-only and must not leak to mobile registers.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, tier } from './auth';

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /**
     * Stripe customer object id (`cus_…`). Stable per org for the
     * lifetime of the org; reused across cancel-and-resubscribe cycles.
     */
    stripeCustomerId: text('stripe_customer_id').notNull().unique(),
    /**
     * Stripe subscription object id (`sub_…`). Null between
     * cancellation and the next checkout — at that point the customer
     * row exists but no subscription does.
     */
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    /**
     * Stripe subscription `status` field, mirrored verbatim. Common
     * values: `active`, `trialing`, `past_due`, `canceled`,
     * `incomplete`, `incomplete_expired`, `unpaid`. Null when there's
     * no current subscription.
     */
    status: text('status'),
    /**
     * Which paid tier the latest subscription maps to. `free` is
     * impossible here (free orgs have no row); only `pro` or
     * `business`. Source of truth for `organizations.tier` flips when
     * a sub becomes / stops being active.
     */
    tier: tier('tier').notNull(),
    /**
     * Unix timestamp from Stripe converted to a Postgres timestamp.
     * Used by the dashboard to render "renews on …" / "access until
     * …" copy without an extra Stripe round-trip.
     */
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    /**
     * Whether the subscription is set to terminate at the end of the
     * current period (typically because the user clicked "cancel" in
     * the Stripe portal). The org keeps its paid tier until period
     * end; the webhook flips the tier to `free` on the
     * `customer.subscription.deleted` event that fires at expiry.
     */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index('billing_subscriptions_customer_id_idx').on(table.stripeCustomerId),
    subscriptionIdIdx: index('billing_subscriptions_subscription_id_idx').on(
      table.stripeSubscriptionId,
    ),
  }),
);

export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type NewBillingSubscription = typeof billingSubscriptions.$inferInsert;
