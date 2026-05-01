/**
 * Sync PUSH integration test (Blueprint: real-push-path).
 *
 * Drives the service directly so the test does not need a live
 * WebSocket client. Persistence is the unit under test; the WS
 * handler is a thin shell over `processPush`.
 *
 * Skips when DATABASE_URL is unreachable (CI provides a service
 * container; contributors without a local Postgres stay green).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  customers,
  inventoryMovements,
  orderItems,
  orders,
  organizations,
  products,
  syncIdempotency,
  users,
  variants,
} from '@counter/schema';
import { eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { processPush, type PushOpInput } from '../src/sync/service.js';

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_push';
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

test('sync push', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping sync-push suite (CI runs it).');
    return;
  }

  setEnv();
  const db = getDb();

  // Seed an org and the catalog rows the order will reference. The
  // PUSH path doesn't need the org's user to exist (clerk-bypass not
  // involved), but it does need a real org row + a variant FK.
  const clerkOrgId = `org_test_push_${randomUUID()}`;
  const clerkUserId = `user_test_push_${randomUUID()}`;
  const slug = `counter-push-${randomUUID().slice(0, 8)}`;

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId, name: 'Counter Push Test', slug, region: 'US' })
    .returning();
  assert.ok(org);
  const orgId = org.id;

  await db.insert(users).values({
    clerkUserId,
    email: `${clerkUserId}@example.com`,
    activeOrgId: orgId,
  });

  const productId = randomUUID();
  await db.insert(products).values({ id: productId, orgId, name: 'Espresso' });
  const variantSingleId = randomUUID();
  const variantDoubleId = randomUUID();
  await db.insert(variants).values([
    { id: variantSingleId, orgId, productId, name: 'Single', priceCents: 350 },
    { id: variantDoubleId, orgId, productId, name: 'Double', priceCents: 450 },
  ]);

  const cleanup = async () => {
    await db.delete(syncIdempotency).where(eq(syncIdempotency.orgId, orgId));
    await db.delete(orderItems).where(eq(orderItems.orgId, orgId));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.orgId, orgId));
    await db.delete(orders).where(eq(orders.orgId, orgId));
    await db.delete(customers).where(eq(customers.orgId, orgId));
    await db.delete(variants).where(eq(variants.orgId, orgId));
    await db.delete(products).where(eq(products.orgId, orgId));
    await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  };

  try {
    const orderId = randomUUID();
    const itemSingleId = randomUUID();
    const itemDoubleId = randomUUID();

    const ops: PushOpInput[] = [
      {
        clientOpId: randomUUID(),
        table: 'orders',
        asDelta: false,
        data: {
          id: orderId,
          payment_method: 'cash',
          subtotal_cents: 800,
          total_cents: 800,
        },
      },
      {
        clientOpId: randomUUID(),
        table: 'order_items',
        asDelta: false,
        data: {
          id: itemSingleId,
          order_id: orderId,
          variant_id: variantSingleId,
          name_snapshot: 'Espresso · Single',
          qty: 1,
          unit_price_cents: 350,
          subtotal_cents: 350,
        },
      },
      {
        clientOpId: randomUUID(),
        table: 'order_items',
        asDelta: false,
        data: {
          id: itemDoubleId,
          order_id: orderId,
          variant_id: variantDoubleId,
          name_snapshot: 'Espresso · Double',
          qty: 1,
          unit_price_cents: 450,
          subtotal_cents: 450,
        },
      },
    ];

    await t.test('persists multi-table batch and bumps current_version', async () => {
      const results = await processPush({ db, orgId, ops });
      assert.equal(results.length, 3);
      assert.ok(results.every((r) => r.ok));
      assert.ok(results.every((r) => r.version === '1'));

      const [orgRow] = await db
        .select({ currentVersion: organizations.currentVersion })
        .from(organizations)
        .where(eq(organizations.id, orgId));
      assert.equal(orgRow?.currentVersion, 1n);

      const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
      assert.ok(orderRow);
      assert.equal(orderRow.totalCents, 800);

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      assert.equal(items.length, 2);
    });

    await t.test('replay is idempotent — no new rows, no version bump', async () => {
      const results = await processPush({ db, orgId, ops });
      assert.equal(results.length, 3);
      assert.ok(results.every((r) => r.ok));
      // Replays carry the original record id, but no version (client
      // can PULL to reconcile if it cares).
      assert.equal(results[0]?.id, orderId);
      assert.ok(results.every((r) => r.version === undefined));

      const [orgRow] = await db
        .select({ currentVersion: organizations.currentVersion })
        .from(organizations)
        .where(eq(organizations.id, orgId));
      assert.equal(orgRow?.currentVersion, 1n);

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      assert.equal(items.length, 2);
    });

    await t.test('inventory_movements are append-only with new versions', async () => {
      const movementId = randomUUID();
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'inventory_movements',
            asDelta: true,
            data: {
              id: movementId,
              variant_id: variantSingleId,
              delta: -1,
              reason: 'sale',
              device_id: 'device-test',
            },
          },
        ],
      });
      assert.equal(results.length, 1);
      assert.equal(results[0]?.ok, true);
      assert.equal(results[0]?.version, '2');

      const [movement] = await db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.id, movementId));
      assert.ok(movement);
      assert.equal(movement.delta, -1);
    });

    await t.test('unsupported_table reports error without affecting siblings', async () => {
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            // refunds is not in the SUPPORTED set yet
            table: 'refunds',
            asDelta: false,
            data: { id: randomUUID() },
          },
        ],
      });
      assert.equal(results[0]?.ok, false);
      assert.match(results[0]?.error ?? '', /unsupported_table/);
    });
  } finally {
    await cleanup();
  }
});
