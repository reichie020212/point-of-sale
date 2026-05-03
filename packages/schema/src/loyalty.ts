/**
 * Punchcard loyalty (locked §9 decision).
 *
 * Two tables:
 *
 *   - `loyalty_programs` — the merchant-defined rule. "Buy N items
 *     of target X, get the next one free." `target_type` is `product`
 *     or `category`; `target_id` is the FK on the corresponding table.
 *     `threshold` is the N (e.g. 9 → "buy 9, the 10th is free").
 *
 *   - `loyalty_punches` — append-only ledger of per-customer progress.
 *     Each row is one punch (or one redemption — see `is_redemption`).
 *     Punches are linked to the order_item that earned them so a refund
 *     can tombstone them in lockstep with the underlying sale.
 *
 * The ledger shape (vs a single mutable `punches_count` column on
 * customers) is deliberate: it survives multi-device offline sales,
 * gives an audit trail, and lets a refunded sale invalidate its
 * punches without a CRDT tug-of-war.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from './auth';
import { customers } from './customers';

export const loyaltyTargetType = pgEnum('loyalty_target_type', ['product', 'category']);
export const loyaltyProgramStatus = pgEnum('loyalty_program_status', ['active', 'archived']);

export const loyaltyPrograms = pgTable(
  'loyalty_programs',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** `product` or `category`. */
    targetType: loyaltyTargetType('target_type').notNull(),
    /** UUID of the targeted product or category. No FK because the
     *  target table varies; soft-validated at write time. */
    targetId: uuid('target_id').notNull(),
    /** Number of qualifying purchases needed before redemption. */
    threshold: integer('threshold').notNull(),
    status: loyaltyProgramStatus('status').notNull().default('active'),
    /** Idempotency key from the client; dedupes retries on flaky networks. */
    clientOpId: text('client_op_id'),
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
    orgIdx: index('loyalty_programs_org_id_idx').on(table.orgId),
    targetIdx: index('loyalty_programs_target_idx').on(table.orgId, table.targetType, table.targetId),
    versionIdx: index('loyalty_programs_org_version_idx').on(table.orgId, table.version),
    clientOpIdIdx: index('loyalty_programs_client_op_id_idx').on(table.orgId, table.clientOpId),
  }),
);

export const loyaltyPunches = pgTable(
  'loyalty_punches',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
    /** The order_item that earned (or consumed) this punch. Lets a
     *  refund tombstone its punches in lockstep with the underlying
     *  sale. Soft-FK as text — `order_items` is in another schema file
     *  and we want to avoid a circular import. */
    orderItemId: text('order_item_id'),
    /** True when this row is a redemption (the "free" item). False
     *  for an earned punch. The merchant's progress is the count of
     *  earned-not-redeemed rows. */
    isRedemption: boolean('is_redemption').notNull().default(false),
    /** Idempotency key from the client; dedupes retries on flaky networks. */
    clientOpId: text('client_op_id'),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index('loyalty_punches_org_id_idx').on(table.orgId),
    customerIdx: index('loyalty_punches_customer_idx').on(table.orgId, table.customerId, table.programId),
    programIdx: index('loyalty_punches_program_idx').on(table.orgId, table.programId),
    versionIdx: index('loyalty_punches_org_version_idx').on(table.orgId, table.version),
    clientOpIdIdx: index('loyalty_punches_client_op_id_idx').on(table.orgId, table.clientOpId),
  }),
);

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert;
export type LoyaltyPunch = typeof loyaltyPunches.$inferSelect;
export type NewLoyaltyPunch = typeof loyaltyPunches.$inferInsert;
export type LoyaltyTargetType = (typeof loyaltyTargetType.enumValues)[number];
export type LoyaltyProgramStatus = (typeof loyaltyProgramStatus.enumValues)[number];
