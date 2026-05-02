/**
 * Sync maintenance integration test.
 *
 * Inserts an "old" sync_idempotency row, runs `pruneIdempotency`,
 * and asserts the row is gone while a fresh row alongside it
 * survives.
 *
 * Skips when DATABASE_URL is unreachable so contributors without a
 * local Postgres stay green; CI runs against the service container.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { organizations, syncIdempotency } from '@counter/schema';
import { and, eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { IDEMPOTENCY_TTL_MS, pruneIdempotency } from '../src/sync/maintenance.js';

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_maintenance';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZGV2LXNpdGUuY2xlcmsuYWNjb3VudHMuZGV2JA';
}

async function dbReachable(): Promise<boolean> {
  setEnv();
  try {
    initDb(process.env.DATABASE_URL!);
    const db = getDb();
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
    return true;
  } catch {
    return false;
  }
}

test('idempotency prune', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping (CI runs it).');
    return;
  }
  setEnv();
  const db = getDb();

  const [org] = await db
    .insert(organizations)
    .values({
      clerkOrgId: `org_test_${randomUUID()}`,
      name: 'Maintenance Test',
      slug: `maint-${randomUUID().slice(0, 8)}`,
      region: 'US',
      tier: 'pro',
    })
    .returning();
  assert.ok(org);

  const oldOpId = `op_old_${randomUUID()}`;
  const newOpId = `op_new_${randomUUID()}`;
  const oldDate = new Date(Date.now() - IDEMPOTENCY_TTL_MS - 60_000);
  const newDate = new Date();

  await db.insert(syncIdempotency).values([
    {
      orgId: org.id,
      clientOpId: oldOpId,
      tableName: 'orders',
      recordId: randomUUID(),
      processedAt: oldDate,
    },
    {
      orgId: org.id,
      clientOpId: newOpId,
      tableName: 'orders',
      recordId: randomUUID(),
      processedAt: newDate,
    },
  ]);

  const result = await pruneIdempotency(db);
  // The "old" row is ours; other rows from prior test runs may also
  // have been pruned. We assert at least one row was removed and
  // that the survivor is the fresh op.
  assert.ok(result.deleted >= 1, 'expected at least one prune');

  const [survivor] = await db
    .select()
    .from(syncIdempotency)
    .where(and(eq(syncIdempotency.orgId, org.id), eq(syncIdempotency.clientOpId, newOpId)))
    .limit(1);
  assert.ok(survivor, 'fresh row should survive');

  const old = await db
    .select()
    .from(syncIdempotency)
    .where(and(eq(syncIdempotency.orgId, org.id), eq(syncIdempotency.clientOpId, oldOpId)))
    .limit(1);
  assert.equal(old.length, 0, 'old row should be gone');

  await db.delete(syncIdempotency).where(eq(syncIdempotency.orgId, org.id));
  await db.delete(organizations).where(eq(organizations.id, org.id));
});
