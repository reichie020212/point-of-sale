/**
 * Orders, order items, refunds.
 *
 * Orders are append-only — once paid, the row is immutable. Mistakes
 * are corrected by issuing a `refund` (a new row), never by editing
 * the original order. This is the "audit trail wins over mutability"
 * stance from HANDOFF §4.
 *
 * Money fields are integers in cents to avoid floating-point drift
 * (HANDOFF non-negotiable: every price is a fixed-point number).
 *
 * `modifiers_json` snapshots the chosen modifiers at sale time. We
 * intentionally denormalize here so a later edit of a modifier name
 * doesn't rewrite history.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './auth';
import { variants } from './catalog';
import { customers } from './customers';
import { devices, shifts } from './devices';

export const orderStatus = pgEnum('order_status', ['paid', 'refunded', 'partially_refunded']);
export const paymentMethod = pgEnum('payment_method', ['cash', 'card', 'split', 'mock']);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    cashierId: uuid('cashier_id').references(() => users.id, { onDelete: 'set null' }),
    status: orderStatus('status').notNull().default('paid'),
    paymentMethod: paymentMethod('payment_method').notNull(),
    /** Sum of order_items subtotals before tax/tip, in cents. */
    subtotalCents: integer('subtotal_cents').notNull(),
    taxCents: integer('tax_cents').notNull().default(0),
    tipCents: integer('tip_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    /** Final amount charged: subtotal - discount + tax + tip. */
    totalCents: integer('total_cents').notNull(),
    /** External payment provider reference (Stripe charge id, etc.). */
    paymentReference: text('payment_reference'),
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
    orgIdx: index('orders_org_id_idx').on(table.orgId),
    customerIdx: index('orders_customer_idx').on(table.customerId),
    shiftIdx: index('orders_shift_idx').on(table.shiftId),
    createdAtIdx: index('orders_created_at_idx').on(table.orgId, table.createdAt),
    versionIdx: index('orders_org_version_idx').on(table.orgId, table.version),
    clientOpIdIdx: index('orders_client_op_id_idx').on(table.orgId, table.clientOpId),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'restrict' }),
    /** Captured product/variant name — survives later product renames. */
    nameSnapshot: text('name_snapshot').notNull(),
    qty: integer('qty').notNull(),
    /** Unit price at sale time, in cents. */
    unitPriceCents: integer('unit_price_cents').notNull(),
    /** qty * (unitPrice + sum(modifier prices)). */
    subtotalCents: integer('subtotal_cents').notNull(),
    /** Snapshot of modifiers chosen: [{ id, name, priceCents }]. */
    modifiersJson: jsonb('modifiers_json').$type<
      Array<{ id: string; name: string; priceCents: number }>
    >(),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    orgIdx: index('order_items_org_id_idx').on(table.orgId),
    orderIdx: index('order_items_order_idx').on(table.orderId),
    variantIdx: index('order_items_variant_idx').on(table.variantId),
    versionIdx: index('order_items_org_version_idx').on(table.orgId, table.version),
  }),
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /**
     * Canonical refund total: `subtotalCents + taxCents + tipCents - discountCents`.
     * Always positive. The component breakdown below lets reports answer
     * "how much tax was returned this month" without rerunning the math
     * against the original order.
     */
    amountCents: integer('amount_cents').notNull(),
    /** Sum of refunded line subtotals (qty × unit price), in cents. */
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    /**
     * Tax portion of this refund — pro-rated by subtotal share, except
     * on the closing-out refund which captures the floor() remainder so
     * `Σ refunds.tax_cents = order.tax_cents` once fully refunded.
     */
    taxCents: integer('tax_cents').notNull().default(0),
    /**
     * Tip portion. Tipping in PH is a gesture for the service rendered,
     * so it's all-or-nothing: zero on partial refunds, full
     * `order.tip_cents` on the refund that closes out the order.
     */
    tipCents: integer('tip_cents').notNull().default(0),
    /** Pro-rated share of the order-level discount that's "un-applied"
     *  by this refund — reduces the amount returned to the customer. */
    discountCents: integer('discount_cents').notNull().default(0),
    /** Free-text reason; required at the UI layer (cashier types it before submit). */
    reason: text('reason'),
    processedById: uuid('processed_by_id').references(() => users.id, { onDelete: 'set null' }),
    paymentReference: text('payment_reference'),
    /** Idempotency key from the client; dedupes retries on flaky networks. */
    clientOpId: text('client_op_id'),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    orgIdx: index('refunds_org_id_idx').on(table.orgId),
    orderIdx: index('refunds_order_idx').on(table.orderId),
    versionIdx: index('refunds_org_version_idx').on(table.orgId, table.version),
    clientOpIdIdx: index('refunds_client_op_id_idx').on(table.orgId, table.clientOpId),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
