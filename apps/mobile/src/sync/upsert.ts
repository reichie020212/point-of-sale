/**
 * Upsert a record received from sync into the local Watermelon
 * collection.
 *
 * Stub for M6. The full implementation:
 *   1. looks up the row by `server_id` (mirroring server's `id`);
 *   2. updates if found, creates if not;
 *   3. respects `deleted_at` tombstones (delete locally if set).
 *
 * Lands once the model classes in src/db/models/* are in. For now we
 * log the table + id so the sync handshake can be observed end-to-end
 * during dev.
 */
import type { SyncTable } from '@counter/sync';

export async function upsertRecord(
  table: SyncTable,
  record: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[sync] upsert', table, (record as { id?: string }).id);
  // TODO(M6): real upsert into database.get(table) once model classes
  // land. The shape of `record` matches the server schema (snake_case
  // already applied).
  return Promise.resolve();
}
