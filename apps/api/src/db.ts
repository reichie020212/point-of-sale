/**
 * Process-wide database singleton. The Fastify plugin in `plugins/db.ts`
 * decorates the request with a reference to it, so handlers do not import
 * this directly.
 */
import { createDb, type Db } from '@counter/schema';

let _db: Db | undefined;

export function initDb(connectionString: string): Db {
  if (!_db) _db = createDb({ connectionString });
  return _db;
}

export function getDb(): Db {
  if (!_db) throw new Error('Database not initialised. Call initDb() at boot.');
  return _db;
}
