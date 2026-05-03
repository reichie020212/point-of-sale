/**
 * Sync push service — server-side persistence for client mutations.
 *
 * Contract per docs/blueprints/real-push-path.md:
 *   1. open a transaction.
 *   2. drop ops whose (orgId, clientOpId) is already in
 *      `sync_idempotency` — those have been processed before, possibly
 *      retried after a flaky network.
 *   3. if any ops remain, increment `organizations.current_version`
 *      once and stamp the new value onto every row written in the
 *      batch (Lamport clock).
 *   4. for each op: upsert into the target table, then insert into
 *      `sync_idempotency`.
 *   5. commit.
 *
 * Returned per-op shape mirrors @counter/sync's AckMessage so the
 * caller (the WS handler) only has to forward results, not reshape
 * them.
 *
 * Inventory ops are append-only: the row's `id` may be newly minted by
 * the server but the `delta`/`reason` fields make every insert
 * additive. The on-hand cache stays computed-on-read for now (the
 * trigger/view milestone is separate).
 */
import {
  categories,
  customers,
  inventoryMovements,
  orderItems,
  orders,
  organizations,
  products,
  refunds,
  shifts,
  syncIdempotency,
  variants,
  type Db,
} from '@counter/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { SyncTable } from '@counter/sync';

export interface PushOpInput {
  clientOpId: string;
  table: SyncTable;
  data: Record<string, unknown>;
  asDelta: boolean;
}

export interface PushOpResult {
  clientOpId: string;
  ok: boolean;
  /** Server's primary-key UUID for the persisted row. Absent on dupes. */
  id?: string;
  /** Bigint cursor as decimal string. Absent on dupes — the client
   *  can resync via PULL if it cares about the row's current version. */
  version?: string;
  error?: string;
}

interface ProcessPushArgs {
  db: Db;
  orgId: string;
  ops: PushOpInput[];
}

/** Tables we accept PUSHes for. Keep in lockstep with the dispatch
 *  table below; anything else returns ok:false / error:'unsupported_table'. */
const SUPPORTED: ReadonlySet<SyncTable> = new Set([
  'categories',
  'customers',
  'inventory_movements',
  'order_items',
  'orders',
  'products',
  'refunds',
  'shifts',
  'variants',
]);

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asJson(value: unknown): unknown {
  return value;
}

function asDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'number') return new Date(value);
  return undefined;
}

/**
 * Per-table writer. Each writer:
 *   - extracts the fields it knows about from `data`,
 *   - ON CONFLICT (id) DO UPDATE for catalog/customer rows (LWW),
 *   - INSERT (no conflict resolution) for sales rows that are
 *     append-only,
 *   - returns the row's `id`.
 *
 * The shape returned to the caller via `RETURNING` is intentionally
 * narrow — only `id` is consumed.
 */
type Writer = (
  tx: Db,
  orgId: string,
  data: Record<string, unknown>,
  newVersion: bigint,
) => Promise<string | null>;

const writers: Record<string, Writer> = {
  categories: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const name = asString(data.name);
    if (!id || !name) return null;
    const values = {
      id,
      orgId,
      name,
      sortOrder: asNumber(data.sort_order ?? data.sortOrder) ?? 0,
      version,
      deletedAt: asDate(data.deleted_at ?? data.deletedAt) ?? null,
      updatedAt: new Date(),
    };
    await tx
      .insert(categories)
      .values(values)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: values.name,
          sortOrder: values.sortOrder,
          version,
          deletedAt: values.deletedAt,
          updatedAt: values.updatedAt,
        },
      });
    return id;
  },

  products: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const name = asString(data.name);
    if (!id || !name) return null;
    const status = asString(data.status) === 'archived' ? 'archived' : 'active';
    const values = {
      id,
      orgId,
      categoryId: asString(data.category_id ?? data.categoryId) ?? null,
      name,
      description: asString(data.description) ?? null,
      imagePath: asString(data.image_path ?? data.imagePath) ?? null,
      status: status as 'active' | 'archived',
      version,
      deletedAt: asDate(data.deleted_at ?? data.deletedAt) ?? null,
      updatedAt: new Date(),
    };
    await tx
      .insert(products)
      .values(values)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          categoryId: values.categoryId,
          name: values.name,
          description: values.description,
          imagePath: values.imagePath,
          status: values.status,
          version,
          deletedAt: values.deletedAt,
          updatedAt: values.updatedAt,
        },
      });
    return id;
  },

  variants: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const productId = asString(data.product_id ?? data.productId);
    const name = asString(data.name);
    const priceCents = asNumber(data.price_cents ?? data.priceCents);
    if (!id || !productId || !name || priceCents === undefined) return null;
    const values = {
      id,
      orgId,
      productId,
      name,
      sku: asString(data.sku) ?? null,
      barcode: asString(data.barcode) ?? null,
      priceCents,
      version,
      deletedAt: asDate(data.deleted_at ?? data.deletedAt) ?? null,
      updatedAt: new Date(),
    };
    await tx
      .insert(variants)
      .values(values)
      .onConflictDoUpdate({
        target: variants.id,
        set: {
          productId: values.productId,
          name: values.name,
          sku: values.sku,
          barcode: values.barcode,
          priceCents: values.priceCents,
          version,
          deletedAt: values.deletedAt,
          updatedAt: values.updatedAt,
        },
      });
    return id;
  },

  customers: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    if (!id) return null;
    const values = {
      id,
      orgId,
      name: asString(data.name) ?? null,
      email: asString(data.email) ?? null,
      phone: asString(data.phone) ?? null,
      loyaltyPoints: asNumber(data.loyalty_points ?? data.loyaltyPoints) ?? 0,
      version,
      deletedAt: asDate(data.deleted_at ?? data.deletedAt) ?? null,
      updatedAt: new Date(),
    };
    await tx
      .insert(customers)
      .values(values)
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: values.name,
          email: values.email,
          phone: values.phone,
          loyaltyPoints: values.loyaltyPoints,
          version,
          deletedAt: values.deletedAt,
          updatedAt: values.updatedAt,
        },
      });
    return id;
  },

  orders: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const subtotalCents = asNumber(data.subtotal_cents ?? data.subtotalCents);
    const totalCents = asNumber(data.total_cents ?? data.totalCents);
    const paymentMethodValue = asString(data.payment_method ?? data.paymentMethod);
    if (!id || subtotalCents === undefined || totalCents === undefined || !paymentMethodValue) {
      return null;
    }
    const values = {
      id,
      orgId,
      customerId: asString(data.customer_id ?? data.customerId) ?? null,
      shiftId: asString(data.shift_id ?? data.shiftId) ?? null,
      deviceId: asString(data.device_id ?? data.deviceId) ?? null,
      cashierId: asString(data.cashier_id ?? data.cashierId) ?? null,
      status: (asString(data.status) ?? 'paid') as 'paid' | 'refunded' | 'partially_refunded',
      paymentMethod: paymentMethodValue as 'cash' | 'card' | 'split' | 'mock',
      subtotalCents,
      taxCents: asNumber(data.tax_cents ?? data.taxCents) ?? 0,
      tipCents: asNumber(data.tip_cents ?? data.tipCents) ?? 0,
      discountCents: asNumber(data.discount_cents ?? data.discountCents) ?? 0,
      totalCents,
      paymentReference: asString(data.payment_reference ?? data.paymentReference) ?? null,
      clientOpId: asString(data.client_op_id ?? data.clientOpId) ?? null,
      version,
      updatedAt: new Date(),
    };
    await tx.insert(orders).values(values).onConflictDoNothing({ target: orders.id });
    return id;
  },

  order_items: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const orderId = asString(data.order_id ?? data.orderId);
    const variantId = asString(data.variant_id ?? data.variantId);
    const nameSnapshot = asString(data.name_snapshot ?? data.nameSnapshot);
    const qty = asNumber(data.qty);
    const unitPriceCents = asNumber(data.unit_price_cents ?? data.unitPriceCents);
    const subtotalCents = asNumber(data.subtotal_cents ?? data.subtotalCents);
    if (
      !id ||
      !orderId ||
      !variantId ||
      !nameSnapshot ||
      qty === undefined ||
      unitPriceCents === undefined ||
      subtotalCents === undefined
    ) {
      return null;
    }
    const values = {
      id,
      orgId,
      orderId,
      variantId,
      nameSnapshot,
      qty,
      unitPriceCents,
      subtotalCents,
      modifiersJson: asJson(data.modifiers_json ?? data.modifiersJson) as
        | Array<{ id: string; name: string; priceCents: number }>
        | null,
      version,
    };
    await tx.insert(orderItems).values(values).onConflictDoNothing({ target: orderItems.id });
    return id;
  },

  inventory_movements: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const variantId = asString(data.variant_id ?? data.variantId);
    const delta = asNumber(data.delta);
    const reason = asString(data.reason);
    const deviceId = asString(data.device_id ?? data.deviceId);
    if (!id || !variantId || delta === undefined || !reason || !deviceId) return null;
    const values = {
      id,
      orgId,
      variantId,
      delta,
      reason: reason as 'sale' | 'refund' | 'adjustment' | 'restock' | 'count',
      deviceId,
      version,
    };
    await tx
      .insert(inventoryMovements)
      .values(values)
      .onConflictDoNothing({ target: inventoryMovements.id });
    return id;
  },

  refunds: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const orderId = asString(data.order_id ?? data.orderId);
    const amountCents = asNumber(data.amount_cents ?? data.amountCents);
    if (!id || !orderId || amountCents === undefined) return null;

    // Compute the new order status from the cumulative refund total.
    // We read the order + sum of prior refunds inside the transaction
    // so two simultaneous PUSHes from different devices both see a
    // consistent view. If the cumulative total reaches the order's
    // `totalCents`, mark `refunded`; otherwise `partially_refunded`.
    const [order] = await tx
      .select({ totalCents: orders.totalCents })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.orgId, orgId)))
      .limit(1);
    if (!order) return null;

    const values = {
      id,
      orgId,
      orderId,
      amountCents,
      reason: asString(data.reason) ?? null,
      processedById: asString(data.processed_by_id ?? data.processedById) ?? null,
      paymentReference: asString(data.payment_reference ?? data.paymentReference) ?? null,
      clientOpId: asString(data.client_op_id ?? data.clientOpId) ?? null,
      version,
    };
    await tx.insert(refunds).values(values).onConflictDoNothing({ target: refunds.id });

    const [refundedTotal] = await tx
      .select({ sum: sql<string>`coalesce(sum(${refunds.amountCents}), 0)` })
      .from(refunds)
      .where(and(eq(refunds.orderId, orderId), eq(refunds.orgId, orgId)));
    const refundedSum = Number(refundedTotal?.sum ?? 0);
    const newStatus: 'refunded' | 'partially_refunded' =
      refundedSum >= order.totalCents ? 'refunded' : 'partially_refunded';

    await tx
      .update(orders)
      .set({ status: newStatus, version, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.orgId, orgId)));

    return id;
  },

  shifts: async (tx, orgId, data, version) => {
    const id = asString(data.id);
    const deviceId = asString(data.device_id ?? data.deviceId);
    const userId = asString(data.user_id ?? data.userId);
    const openedAt = asDate(data.opened_at ?? data.openedAt);
    const openingCashCents = asNumber(data.opening_cash_cents ?? data.openingCashCents);
    if (!id || !deviceId || !userId || !openedAt || openingCashCents === undefined) return null;
    const values = {
      id,
      orgId,
      deviceId,
      userId,
      openedAt,
      closedAt: asDate(data.closed_at ?? data.closedAt) ?? null,
      openingCashCents,
      closingCashCents: asNumber(data.closing_cash_cents ?? data.closingCashCents) ?? null,
      varianceCents: asNumber(data.variance_cents ?? data.varianceCents) ?? null,
      version,
      updatedAt: new Date(),
    };
    await tx
      .insert(shifts)
      .values(values)
      .onConflictDoUpdate({
        target: shifts.id,
        set: {
          closedAt: values.closedAt,
          closingCashCents: values.closingCashCents,
          varianceCents: values.varianceCents,
          version,
          updatedAt: values.updatedAt,
        },
      });
    return id;
  },
};

export async function processPush({ db, orgId, ops }: ProcessPushArgs): Promise<PushOpResult[]> {
  if (ops.length === 0) return [];

  return db.transaction(async (tx: Db) => {
    const allClientOpIds = ops.map((op) => op.clientOpId);
    const seenRows: { clientOpId: string; recordId: string }[] = await tx
      .select({ clientOpId: syncIdempotency.clientOpId, recordId: syncIdempotency.recordId })
      .from(syncIdempotency)
      .where(
        and(eq(syncIdempotency.orgId, orgId), inArray(syncIdempotency.clientOpId, allClientOpIds)),
      );
    const seen = new Map<string, string>(
      seenRows.map((row) => [row.clientOpId, row.recordId]),
    );

    const newOps = ops.filter((op) => !seen.has(op.clientOpId));
    let newVersion: bigint | null = null;

    if (newOps.length > 0) {
      const [bumped] = await tx
        .update(organizations)
        .set({ currentVersion: sql`${organizations.currentVersion} + 1` })
        .where(eq(organizations.id, orgId))
        .returning({ currentVersion: organizations.currentVersion });
      if (!bumped) {
        throw new Error(`org ${orgId} not found while bumping current_version`);
      }
      newVersion = bumped.currentVersion;
    }

    const results: PushOpResult[] = [];
    for (const op of ops) {
      const replayedId = seen.get(op.clientOpId);
      if (replayedId) {
        results.push({ clientOpId: op.clientOpId, ok: true, id: replayedId });
        continue;
      }
      if (!SUPPORTED.has(op.table)) {
        results.push({
          clientOpId: op.clientOpId,
          ok: false,
          error: `unsupported_table:${op.table}`,
        });
        continue;
      }
      const writer = writers[op.table];
      if (!writer || newVersion === null) {
        results.push({
          clientOpId: op.clientOpId,
          ok: false,
          error: `unsupported_table:${op.table}`,
        });
        continue;
      }
      try {
        const id = await writer(tx, orgId, op.data, newVersion);
        if (!id) {
          results.push({
            clientOpId: op.clientOpId,
            ok: false,
            error: 'invalid_payload',
          });
          continue;
        }
        await tx.insert(syncIdempotency).values({
          orgId,
          clientOpId: op.clientOpId,
          tableName: op.table,
          recordId: id,
        });
        results.push({
          clientOpId: op.clientOpId,
          ok: true,
          id,
          version: newVersion.toString(),
        });
      } catch (err) {
        results.push({
          clientOpId: op.clientOpId,
          ok: false,
          error: err instanceof Error ? err.message : 'write_failed',
        });
      }
    }

    return results;
  });
}
