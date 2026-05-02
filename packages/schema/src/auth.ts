/**
 * Auth + tenancy schema.
 *
 * Decoupled from Clerk: every record gets an internal UUID primary key and
 * carries the Clerk identifier in a unique `clerk_*_id` column. Swap of auth
 * provider is then a column rename, not a data migration of every FK.
 *
 * `region` is a Postgres enum so a typo can't sneak past — it's the column
 * that decides which Neon project an org's data lives in (HANDOFF §5).
 *
 * `tier` is the billing tier; gating middleware reads this column to allow
 * or deny sync, dashboard, and multi-location features (HANDOFF §3).
 *
 * `userRole` is the §9 RBAC tier: owner = everything, manager = everything
 * except billing+team, cashier = sell+refund only. Stored on `users` as a
 * single column because v1 is one-user-per-org; if multi-org membership
 * lands the role moves to a `memberships` join table.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const region = pgEnum('region', ['US', 'EU', 'PH']);
export const tier = pgEnum('tier', ['free', 'pro', 'business']);
export const userRole = pgEnum('user_role', ['owner', 'manager', 'cashier']);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    clerkOrgId: text('clerk_org_id').notNull().unique(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    region: region('region').notNull(),
    tier: tier('tier').notNull().default('free'),
    /**
     * IANA timezone (e.g. `America/New_York`). The reports engine
     * buckets sales using this value so "Today" tracks the shop's
     * local opening hours instead of UTC midnight. Default `UTC`
     * keeps existing rows valid; onboarding picks the operator's
     * browser tz.
     */
    timezone: text('timezone').notNull().default('UTC'),
    /**
     * ISO 4217 currency code rendered on every receipt and dashboard
     * total. Default `PHP` because v1 ships PH-only (HANDOFF §9 closed
     * 2026-05-03). Future regions will set their own at org create.
     */
    currency: text('currency').notNull().default('PHP'),
    /**
     * Single flat tax rate per org as a percent with three decimals
     * (e.g. `12.000` for PH VAT). Cart subtotal × rate = tax_cents
     * computed locally at checkout — no per-item tax classes in v1.
     */
    taxRate: numeric('tax_rate', { precision: 5, scale: 3 }).notNull().default('12.000'),
    /**
     * Per-org Lamport clock. Every PUSH batch increments this once and
     * stamps the new value onto every row written in the batch. Sync
     * pulls compare row.version > client.cursor, so monotonic per-org
     * is the only invariant we rely on (gaps allowed).
     */
    currentVersion: bigint('current_version', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /**
     * Row-level Lamport stamp for the org row itself. Used by the
     * sync engine's PULL/EVENT loop so device tax-rate / currency /
     * timezone / name changes can fan out reactively. Distinct from
     * `currentVersion`: this column moves only when the org row
     * changes; `currentVersion` moves on every PUSH batch.
     */
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    clerkIdIdx: index('organizations_clerk_org_id_idx').on(table.clerkOrgId),
    regionIdx: index('organizations_region_idx').on(table.region),
    tierIdx: index('organizations_tier_idx').on(table.tier),
  }),
);

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email').notNull().unique(),
    name: text('name'),
    activeOrgId: uuid('active_org_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    /**
     * RBAC role on the user's active org. Org creators get `owner` at
     * onboarding; invitees default to `cashier`. The API gates catalog,
     * device, and admin mutations against this column.
     */
    role: userRole('role').notNull().default('cashier'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    clerkIdIdx: index('users_clerk_user_id_idx').on(table.clerkUserId),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Region = (typeof region.enumValues)[number];
export type Tier = (typeof tier.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
