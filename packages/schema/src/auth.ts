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
 * TODO(W5): introduce `devices` table for paired mobile hardware. The
 * Week 1 JWT template fakes "session = device" via the Clerk session id.
 */
import { sql } from 'drizzle-orm';
import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const region = pgEnum('region', ['US', 'EU']);
export const tier = pgEnum('tier', ['free', 'pro', 'business']);

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
     * Per-org Lamport clock. Every PUSH batch increments this once and
     * stamps the new value onto every row written in the batch. Sync
     * pulls compare row.version > client.cursor, so monotonic per-org
     * is the only invariant we rely on (gaps allowed).
     */
    currentVersion: bigint('current_version', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
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
