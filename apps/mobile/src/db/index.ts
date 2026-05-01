/**
 * Local database factory.
 *
 * Uses SQLite (via WatermelonDB's SQLiteAdapter) on iOS/Android, and
 * LokiJS in the unlikely event we render the mobile app on web for
 * snapshot tests. JSI is on so reads stay synchronous.
 *
 * Models are intentionally minimal in M4 — most reads happen via raw
 * collection queries. Once we settle on the heavy access patterns the
 * @field-decorated models in src/db/models/* take over.
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (err) => {
    // eslint-disable-next-line no-console
    console.error('[counter/db] WatermelonDB setup failed', err);
  },
});

export const database = new Database({
  adapter,
  // TODO(M5): wire in @nozbe/watermelondb model classes for products/
  // variants/orders. Empty array works as a stub — we use `database
  // .get('table_name')` directly for now.
  modelClasses: [],
});
