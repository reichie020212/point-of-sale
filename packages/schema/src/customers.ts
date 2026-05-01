/**
 * Customers — light CRM.
 *
 * Loyalty default per master Blueprint §6: 1% cashback as points.
 * `loyalty_points` is the canonical balance; movements are tracked as
 * order tips/refunds against this column. TODO(policy-loyalty): once
 * the loyalty model is locked, move to a dedicated `loyalty_movements`
 * ledger so balances are auditable.
 */
import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from './auth';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    /** Loyalty balance in points. 1pt == 1 cent of credit. */
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index('customers_org_id_idx').on(table.orgId),
    emailIdx: index('customers_email_idx').on(table.orgId, table.email),
    phoneIdx: index('customers_phone_idx').on(table.orgId, table.phone),
    versionIdx: index('customers_org_version_idx').on(table.orgId, table.version),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
