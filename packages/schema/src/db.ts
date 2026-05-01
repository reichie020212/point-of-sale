/**
 * Postgres connection factory. Prefer one `Db` per process (the API holds it
 * as a singleton); migrations and one-shot scripts can call `createDb()`
 * with their own connection string.
 *
 * `postgres-js` is the driver Drizzle's `drizzle-orm/postgres-js` adapter
 * binds to. Pool size defaults to a conservative 10; production deploys
 * should set it via env. Idle connections close after 30s.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as auth from './auth';
import * as catalog from './catalog';
import * as customers from './customers';
import * as devices from './devices';
import * as sales from './sales';

const schema = { ...auth, ...catalog, ...customers, ...devices, ...sales };

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateDbOptions {
  connectionString: string;
  /** Max pool size; defaults to 10. Production should set this explicitly. */
  max?: number;
  /** Idle timeout in seconds before a connection is closed. */
  idleTimeout?: number;
  /** Set true on Neon's pooled connection string. */
  prepare?: boolean;
}

export function createDb(opts: CreateDbOptions): Db {
  const client = postgres(opts.connectionString, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeout ?? 30,
    prepare: opts.prepare ?? true,
  });
  return drizzle(client, { schema });
}
