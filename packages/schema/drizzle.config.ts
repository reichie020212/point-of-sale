import type { Config } from 'drizzle-kit';

/**
 * `generate` only diffs the schema against the migrations folder and does
 * not need a live connection. `migrate`, `push`, and `studio` do — they will
 * fail at runtime with a clear error if DATABASE_URL is unset.
 */
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_dev';

export default {
  schema: [
    './src/auth.ts',
    './src/catalog.ts',
    './src/customers.ts',
    './src/devices.ts',
    './src/sales.ts',
    './src/sync.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
} satisfies Config;
