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
  ],
});
