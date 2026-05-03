/**
 * WatermelonDB schema migrations.
 *
 * Each entry tells Watermelon how to mutate an existing local DB
 * forward to a new schema version. A user with v1 installed and v2
 * shipped will run the v2 migration on next launch — preserving any
 * locally-queued sales that haven't synced yet.
 *
 * v2: add `refunds` table for the Refund Flow milestone. Refunds are
 * created on-device (offline-first), enqueued, and reconciled with
 * server-issued refund rows on PULL.
 */
import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
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
  ],
});
