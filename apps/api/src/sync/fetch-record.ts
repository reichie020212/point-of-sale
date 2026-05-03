/**
 * Single-row read by `(table, id)` for the sync fan-out path.
 *
 * After a successful PUSH, the server has the canonical post-commit
 * row in its DB; `serializeRow(row)` produces the snake_case wire
 * shape that the mobile `applyServerChanges` allowlist expects. The
 * EVENT broadcast carries that serialized row so every subscribed
 * device gets the data in one hop.
 *
 * Tombstones ride along: a soft-deleted row still has `deleted_at`
 * set, and the mobile coerce layer treats a non-null `deleted_at` as
 * a destroy signal. We do NOT filter by `isNull(deletedAt)` here —
 * the receiving devices need to see the deletion.
 *
 * Tables not yet on the sync loop (`devices`) return `null`; the
 * caller falls back to a minimal `{ id }` payload so a missing fetch
 * doesn't crash the EVENT publish.
 */
import {
  categories,
  customers,
  inventoryMovements,
  loyaltyPrograms,
  loyaltyPunches,
  modifiers,
  orderItems,
  orders,
  organizations,
  products,
  refunds,
  shifts,
  variants,
  type Db,
} from '@counter/schema';
import { eq } from 'drizzle-orm';

import type { SyncTable } from '@counter/sync';

export async function fetchRecord(
  db: Db,
  table: SyncTable,
  id: string,
): Promise<Record<string, unknown> | null> {
  switch (table) {
    case 'categories': {
      const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      return row ?? null;
    }
    case 'products': {
      const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      return row ?? null;
    }
    case 'variants': {
      const [row] = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
      return row ?? null;
    }
    case 'modifiers': {
      const [row] = await db.select().from(modifiers).where(eq(modifiers.id, id)).limit(1);
      return row ?? null;
    }
    case 'customers': {
      const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      return row ?? null;
    }
    case 'orders': {
      const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      return row ?? null;
    }
    case 'order_items': {
      const [row] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1);
      return row ?? null;
    }
    case 'inventory_movements': {
      const [row] = await db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.id, id))
        .limit(1);
      return row ?? null;
    }
    case 'shifts': {
      const [row] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
      return row ?? null;
    }
    case 'organizations': {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      return row ?? null;
    }
    case 'refunds': {
      const [row] = await db.select().from(refunds).where(eq(refunds.id, id)).limit(1);
      return row ?? null;
    }
    case 'loyalty_programs': {
      const [row] = await db
        .select()
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.id, id))
        .limit(1);
      return row ?? null;
    }
    case 'loyalty_punches': {
      const [row] = await db
        .select()
        .from(loyaltyPunches)
        .where(eq(loyaltyPunches.id, id))
        .limit(1);
      return row ?? null;
    }
    case 'devices':
      // Not on the sync loop yet — fall back to id-only EVENT payload.
      return null;
  }
  // The switch above is exhaustive over SyncTable, but TS narrows the
  // discriminated union conservatively — a SyncTable that ever grows
  // a member without a matching case will fall through here. Returning
  // null is the safe fallback (caller emits an id-only EVENT).
  return null;
}
