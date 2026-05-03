/**
 * Apply server-pushed records into the local Watermelon DB.
 *
 * Called from the SyncClient's `onRecord` callback for both PULL
 * chunks (initial / catch-up) and live EVENTs (other devices' PUSHes
 * coming through the broker fan-out).
 *
 * Algorithm:
 *   1. Look up existing local rows matching the incoming `id`s by
 *      `server_id` (the server's UUID is stored in our `server_id`
 *      column; Watermelon's own `id` is a separate string).
 *   2. Build a Watermelon batch:
 *        - record exists + tombstoned → destroyPermanently
 *        - record exists + alive      → prepareUpdate
 *        - record missing + alive     → prepareCreate
 *        - record missing + tombstone → no-op (already gone)
 *   3. Run the batch inside one `database.write()` so the UI
 *      re-renders atomically.
 *
 * Mapping: server payloads are snake_case; Watermelon columns are
 * snake_case; we copy fields directly. Dates come over as ISO strings
 * and get coerced to ms (numbers) for SQLite.
 *
 * Tables without a local `deleted_at` column (orders, order_items,
 * inventory_movements, shifts) interpret a server tombstone as
 * "destroyPermanently" — they are server-authoritative audit rows
 * with no local soft-delete state.
 */
import { Q } from '@nozbe/watermelondb';

import type { SyncTable } from '@counter/sync';
import type { Database, Model } from '@nozbe/watermelondb';

/** Sync tables we know how to map. The server may emit others
 *  eventually; we ignore unknowns rather than crash. */
const SUPPORTED: ReadonlySet<SyncTable> = new Set([
  'categories',
  'customers',
  'inventory_movements',
  'loyalty_programs',
  'loyalty_punches',
  'modifiers',
  'order_items',
  'orders',
  'products',
  'refunds',
  'shifts',
  'users',
  'variants',
]);

/** Per-table column allowlist — fields the server may emit and we
 *  store locally. Anything outside the list is ignored. */
const COLUMNS: Record<SyncTable, string[]> = {
  categories: ['org_id', 'name', 'sort_order', 'updated_at', 'deleted_at'],
  customers: [
    'org_id',
    'name',
    'email',
    'phone',
    'loyalty_points',
    'updated_at',
    'deleted_at',
  ],
  inventory_movements: [
    'client_op_id',
    'org_id',
    'variant_id',
    'delta',
    'reason',
    'device_id',
    'created_at',
  ],
  modifiers: [
    'org_id',
    'product_id',
    'name',
    'price_cents',
    'multi_select',
    'updated_at',
    'deleted_at',
  ],
  order_items: [
    'org_id',
    'order_id',
    'variant_id',
    'name_snapshot',
    'qty',
    'unit_price_cents',
    'subtotal_cents',
    'modifiers_json',
  ],
  orders: [
    'client_op_id',
    'org_id',
    'customer_id',
    'shift_id',
    'device_id',
    'cashier_id',
    'status',
    'payment_method',
    'subtotal_cents',
    'tax_cents',
    'tip_cents',
    'discount_cents',
    'total_cents',
    'created_at',
    'synced_at',
  ],
  products: [
    'org_id',
    'category_id',
    'name',
    'description',
    'image_path',
    'status',
    'updated_at',
    'deleted_at',
  ],
  shifts: [
    'org_id',
    'device_id',
    'user_id',
    'opened_at',
    'closed_at',
    'opening_cash_cents',
    'closing_cash_cents',
    'variance_cents',
  ],
  variants: [
    'org_id',
    'product_id',
    'name',
    'sku',
    'barcode',
    'price_cents',
    'updated_at',
    'deleted_at',
  ],
  refunds: [
    'client_op_id',
    'org_id',
    'order_id',
    'amount_cents',
    'subtotal_cents',
    'tax_cents',
    'tip_cents',
    'discount_cents',
    'line_qtys_json',
    'reason',
    'processed_by_id',
    'payment_reference',
    'created_at',
  ],
  loyalty_programs: [
    'client_op_id',
    'org_id',
    'name',
    'target_type',
    'target_id',
    'threshold',
    'status',
    'updated_at',
    'deleted_at',
  ],
  loyalty_punches: [
    'client_op_id',
    'org_id',
    'customer_id',
    'program_id',
    'order_item_id',
    'is_redemption',
    'created_at',
    'deleted_at',
  ],
  users: [
    'active_org_id',
    'name',
    'email',
    'role',
    'pin_hash',
    'updated_at',
    'deleted_at',
  ],
  // Devices not mirrored locally; treat as no-op.
  // Organizations is intercepted upstream (useSync routes it to
  // useOrgSettings) before reaching applyServerChanges, so the
  // empty allowlist here is just for type-completeness.
  devices: [],
  organizations: [],
} as const;

function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function coerce(column: string, value: unknown): unknown {
  // Date columns end with `_at`. Convert ISO/strings/numbers to ms.
  if (column.endsWith('_at')) return toMs(value);
  // Any *_json column is stored as a string in SQLite. The server may
  // hand us either a string (already serialized) or a structured
  // object/array (from Drizzle's jsonb decode); normalize to string.
  if (column.endsWith('_json') && value !== null && typeof value !== 'string') {
    return JSON.stringify(value);
  }
  return value;
}

interface RecordWithIdMaybeTombstone {
  id?: unknown;
  deleted_at?: unknown;
}

function isTombstoned(record: Record<string, unknown>): boolean {
  const raw = record.deleted_at ?? (record as { deletedAt?: unknown }).deletedAt;
  if (raw == null) return false;
  if (typeof raw === 'number') return true;
  if (typeof raw === 'string') return raw.length > 0;
  return false;
}

export interface ApplyServerChangesArgs {
  database: Database;
  table: SyncTable;
  records: Record<string, unknown>[];
}

export async function applyServerChanges({
  database,
  table,
  records,
}: ApplyServerChangesArgs): Promise<void> {
  if (records.length === 0) return;
  if (!SUPPORTED.has(table)) return;

  const allowedColumns = COLUMNS[table] ?? [];
  const collection = database.get(table);

  const ids = records
    .map((r) => (r as RecordWithIdMaybeTombstone).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return;

  const existing = await collection.query(Q.where('server_id', Q.oneOf(ids))).fetch();
  const byServerId = new Map<string, Model>();
  for (const row of existing) {
    const serverId = (row as unknown as { _raw: { server_id: string } })._raw.server_id;
    byServerId.set(serverId, row);
  }

  const actions: Model[] = [];
  for (const record of records) {
    const serverId = (record as RecordWithIdMaybeTombstone).id;
    if (typeof serverId !== 'string' || serverId.length === 0) continue;
    const existingRow = byServerId.get(serverId);
    const tombstoned = isTombstoned(record);

    if (tombstoned) {
      if (existingRow) actions.push(existingRow.prepareDestroyPermanently());
      continue;
    }

    if (existingRow) {
      actions.push(
        existingRow.prepareUpdate((row) => {
          const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
          for (const column of allowedColumns) {
            if (column in record) raw[column] = coerce(column, record[column]);
          }
        }),
      );
    } else {
      actions.push(
        collection.prepareCreate((row) => {
          const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
          raw.server_id = serverId;
          for (const column of allowedColumns) {
            if (column in record) raw[column] = coerce(column, record[column]);
          }
        }),
      );
    }
  }

  if (actions.length === 0) return;
  await database.write(async () => {
    await database.batch(...actions);
  });
}

/**
 * Backwards-compatible single-record helper. Used by the SyncClient
 * `onRecord` callback in `useSync.ts`, which supplies the production
 * database. Tests pass a mock through `applyServerChanges` directly.
 */
export async function upsertRecord(
  database: Database,
  table: SyncTable,
  record: Record<string, unknown>,
): Promise<void> {
  await applyServerChanges({ database, table, records: [record] });
}
