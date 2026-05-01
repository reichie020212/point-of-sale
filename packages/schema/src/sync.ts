/**
 * Sync engine plumbing — server-side state that lives outside the
 * domain tables.
 *
 * `sync_idempotency` deduplicates retried PUSH ops. The mobile client
 * generates a `client_op_id` (UUID) per mutation; the server records
 * it here on first successful processing. Subsequent batches that
 * include the same id are short-circuited so a flaky network doesn't
 * cause double-writes.
 *
 * Retention: rows are kept for ~7 days (longer than any plausible
 * client retry window) and pruned by a future maintenance job. The
 * deferred prune is intentional — getting deletion wrong reintroduces
 * the very double-write hazard this table prevents.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from './auth';

export const syncIdempotency = pgTable(
  'sync_idempotency',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientOpId: text('client_op_id').notNull(),
    /** Sync table the op landed against — handy for debugging only. */
    tableName: text('table_name').notNull(),
    /** Server's primary-key UUID for the row the op produced. */
    recordId: uuid('record_id').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.clientOpId] }),
    processedAtIdx: index('sync_idempotency_processed_at_idx').on(table.processedAt),
  }),
);

export type SyncIdempotency = typeof syncIdempotency.$inferSelect;
export type NewSyncIdempotency = typeof syncIdempotency.$inferInsert;
