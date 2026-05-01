/**
 * Catalog & inventory.
 *
 * All sync-replicated tables share five columns that the sync engine
 * (packages/sync) relies on:
 *
 *   - org_id        — tenancy. Every read/write filtered by this.
 *   - version       — bigint Lamport clock per org. Server increments
 *                     on every mutation; clients pull rows where
 *                     version > cursor.
 *   - created_at    — set once at insert.
 *   - updated_at    — bumped on every mutation; LWW conflict resolution
 *                     uses this.
 *   - deleted_at    — soft-delete tombstone. Rows are filtered from
 *                     normal queries but streamed in PULL for 30 days
 *                     so offline devices converge.
 *
 * Inventory uses delta-CRDT: `inventory_movements` is append-only,
 * `onHand` is computed by SUM(delta) per variant.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './auth';

export const productStatus = pgEnum('product_status', ['active', 'archived']);

export const inventoryReason = pgEnum('inventory_reason', [
  'sale',
  'refund',
  'adjustment',
  'restock',
  'count',
]);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
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
    orgIdx: index('categories_org_id_idx').on(table.orgId),
    versionIdx: index('categories_org_version_idx').on(table.orgId, table.version),
  }),
);

export const products = pgTable(
  'products',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    imagePath: text('image_path'),
    status: productStatus('status').notNull().default('active'),
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
    orgIdx: index('products_org_id_idx').on(table.orgId),
    versionIdx: index('products_org_version_idx').on(table.orgId, table.version),
    categoryIdx: index('products_category_idx').on(table.categoryId),
  }),
);

export const variants = pgTable(
  'variants',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sku: text('sku'),
    barcode: text('barcode'),
    /** Price in the smallest currency unit (cents). */
    priceCents: integer('price_cents').notNull(),
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
    orgIdx: index('variants_org_id_idx').on(table.orgId),
    productIdx: index('variants_product_idx').on(table.productId),
    versionIdx: index('variants_org_version_idx').on(table.orgId, table.version),
    skuIdx: index('variants_sku_idx').on(table.orgId, table.sku),
    barcodeIdx: index('variants_barcode_idx').on(table.orgId, table.barcode),
  }),
);

export const modifiers = pgTable(
  'modifiers',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Modifier price delta in cents (can be 0 for free modifiers). */
    priceCents: integer('price_cents').notNull().default(0),
    multiSelect: integer('multi_select').notNull().default(0), // 0 = single, 1+ = max selectable
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
    orgIdx: index('modifiers_org_id_idx').on(table.orgId),
    productIdx: index('modifiers_product_idx').on(table.productId),
    versionIdx: index('modifiers_org_version_idx').on(table.orgId, table.version),
  }),
);

/**
 * Append-only ledger of inventory deltas (delta-CRDT).
 *
 * `onHand(variantId) = SUM(delta) FOR variant_id`. Two offline registers
 * that both decrement the last unit will both succeed locally; on
 * reconnect the server still has both rows and the on-hand count goes
 * negative — the sync engine surfaces a "Sold out elsewhere" notice on
 * the loser's screen rather than rejecting the write (HANDOFF §4).
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    /** Negative for sales, positive for restocks. */
    delta: integer('delta').notNull(),
    reason: inventoryReason('reason').notNull(),
    /** Approximated as Clerk session id in W1; real device id in W5/6. */
    deviceId: text('device_id').notNull(),
    /** Idempotency key — clients send a stable id; server dedupes on retry. */
    clientOpId: text('client_op_id'),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    orgIdx: index('inventory_movements_org_id_idx').on(table.orgId),
    variantIdx: index('inventory_movements_variant_idx').on(table.variantId),
    versionIdx: index('inventory_movements_org_version_idx').on(table.orgId, table.version),
    clientOpIdIdx: index('inventory_movements_client_op_id_idx').on(table.orgId, table.clientOpId),
  }),
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Variant = typeof variants.$inferSelect;
export type NewVariant = typeof variants.$inferInsert;
export type Modifier = typeof modifiers.$inferSelect;
export type NewModifier = typeof modifiers.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type InventoryReason = (typeof inventoryReason.enumValues)[number];
