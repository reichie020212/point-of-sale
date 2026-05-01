/**
 * Auth + tenancy schema (Week 1).
 *
 * Decoupled from Clerk: every record gets an internal UUID primary key and
 * carries the Clerk identifier in a unique `clerk_*_id` column. Swap of auth
 * provider is then a column rename, not a data migration of every FK.
 *
 * `region` is a Postgres enum so a typo can't sneak past — it's the column
 * that decides which Neon project an org's data lives in (HANDOFF §5).
 *
 * TODO(W5): introduce `devices` table for paired mobile hardware. The
 * Week 1 JWT template fakes "session = device" via the Clerk session id.
 */
import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const region = pgEnum('region', ['US', 'EU']);

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
