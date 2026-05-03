/**
 * WatermelonDB schema migrations.
 *
 * Each entry tells Watermelon how to mutate an existing local DB
 * forward to a new schema version. A user with v1 installed and v4
 * shipped will run v2 → v3 → v4 in order on next launch — preserving
 * any locally-queued sales that haven't synced yet.
 *
 * Watermelon expects migrations sorted *descending* by `toVersion`
 * (newest first); it walks the list backwards to find the next step
 * to apply.
 *
 * v2: refunds table for the Refund Flow milestone.
 * v3: loyalty_programs + loyalty_punches for the Punchcard milestone.
 * v4: users table for the PIN sign-in milestone — mirrors the server
 *     `users` row so PIN verification works offline.
 * v5: refund breakdown columns (subtotal/tax/tip/discount) so partial
 *     refunds can pro-rate tax + discount and so a closing-out refund
 *     can return the tip — pre-v5 refund rows backfill to 0.
 */
import {
  schemaMigrations,
  createTable,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'refunds',
          columns: [
            { name: 'subtotal_cents', type: 'number' },
            { name: 'tax_cents', type: 'number' },
            { name: 'tip_cents', type: 'number' },
            { name: 'discount_cents', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'users',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'active_org_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string', isOptional: true },
            { name: 'email', type: 'string', isOptional: true },
            { name: 'role', type: 'string' },
            { name: 'pin_hash', type: 'string', isOptional: true, isIndexed: true },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'orders',
          columns: [
            { name: 'cashier_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
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
        createTable({
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
      ],
    },
    {
      toVersion: 2,
      steps: [
        createTable({
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
      ],
    },
  ],
});
