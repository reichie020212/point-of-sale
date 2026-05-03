/**
 * WatermelonDB schema — local mirror of packages/schema (server side).
 *
 * Watermelon manages its own sync metadata (`_status`, `_changed`); we do
 * NOT replicate the server's `version` Lamport column here. The sync
 * adapter in `src/sync/adapter.ts` translates between the two.
 *
 * Tables match the server names; column names use snake_case to keep
 * sync payloads readable.
 *
 * TODO(M5): switch the cart to use this DB instead of in-memory state.
 * TODO(M6): add the `sync_queue` table for FIFO push backlog.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'categories',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'sort_order', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'products',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'category_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'image_path', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'variants',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'sku', type: 'string', isOptional: true, isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'price_cents', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'modifiers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'price_cents', type: 'number' },
        { name: 'multi_select', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'email', type: 'string', isOptional: true, isIndexed: true },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'loyalty_points', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'shift_id', type: 'string', isOptional: true },
        { name: 'device_id', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'payment_method', type: 'string' },
        { name: 'subtotal_cents', type: 'number' },
        { name: 'tax_cents', type: 'number' },
        { name: 'tip_cents', type: 'number' },
        { name: 'discount_cents', type: 'number' },
        { name: 'total_cents', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'order_items',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'variant_id', type: 'string' },
        { name: 'name_snapshot', type: 'string' },
        { name: 'qty', type: 'number' },
        { name: 'unit_price_cents', type: 'number' },
        { name: 'subtotal_cents', type: 'number' },
        { name: 'modifiers_json', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'inventory_movements',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'variant_id', type: 'string', isIndexed: true },
        { name: 'delta', type: 'number' },
        { name: 'reason', type: 'string' },
        { name: 'device_id', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'shifts',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'device_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'opened_at', type: 'number' },
        { name: 'closed_at', type: 'number', isOptional: true },
        { name: 'opening_cash_cents', type: 'number' },
        { name: 'closing_cash_cents', type: 'number', isOptional: true },
        { name: 'variance_cents', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'refunds',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'amount_cents', type: 'number' },
        { name: 'reason', type: 'string', isOptional: true },
        { name: 'processed_by_id', type: 'string', isOptional: true },
        { name: 'payment_reference', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'loyalty_programs',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'target_type', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'threshold', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'loyalty_punches',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'org_id', type: 'string', isIndexed: true },
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'program_id', type: 'string', isIndexed: true },
        { name: 'order_item_id', type: 'string', isOptional: true },
        { name: 'is_redemption', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'client_op_id', type: 'string', isIndexed: true },
        { name: 'table_name', type: 'string' },
        { name: 'payload_json', type: 'string' },
        { name: 'as_delta', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'attempts', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
      ],
    }),
  ],
});
