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

import { migrations } from './migrations';
import {
  Category,
  Customer,
  InventoryMovement,
  LoyaltyProgram,
  LoyaltyPunch,
  Modifier,
  Order,
  OrderItem,
  Product,
  Refund,
  Shift,
  User,
  Variant,
} from './models';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
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
    LoyaltyProgram,
    LoyaltyPunch,
    Modifier,
    Order,
    OrderItem,
    Product,
    Refund,
    Shift,
    User,
    Variant,
  ],
});
