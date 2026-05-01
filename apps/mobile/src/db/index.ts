/**
 * Local database factory.
 *
 * Uses SQLite (via WatermelonDB's SQLiteAdapter) on iOS/Android, and
 * LokiJS in the unlikely event we render the mobile app on web for
 * snapshot tests. JSI is on so reads stay synchronous.
 *
 * Model classes are registered for the catalog and sales tables that
 * the PULL upsert touches. The `sync_queue` table stays raw — it has
 * no application reads, just FIFO drain.
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {
  Category,
  Customer,
  InventoryMovement,
  Modifier,
  Order,
  OrderItem,
  Product,
  Shift,
  Variant,
} from './models';
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
  modelClasses: [
    Category,
    Customer,
    InventoryMovement,
    Modifier,
    Order,
    OrderItem,
    Product,
    Shift,
    Variant,
  ],
});
