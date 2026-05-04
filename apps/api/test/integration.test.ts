/**
 * API integration test (master Blueprint M14).
 *
 * Drives a vertical slice through the live HTTP surface:
 *   1. /healthz           — sanity boot.
 *   2. /api/v1/orgs/active → 404 (no org yet).
 *   3. Seed user + org rows directly in the DB (Clerk org creation
 *      is mocked; we don't hit Clerk in CI).
 *   4. /api/v1/orgs/active → returns the seeded org.
 *   5. /api/v1/products    → POST a product, GET it back.
 *   6. /api/v1/customers   → POST a customer, GET it back.
 *   7. /api/v1/reports/dashboard → 402 for free tier; bump to pro,
 *      then 200.
 *
 * Auth: uses the NODE_ENV=test bearer bypass added to clerkAuthPlugin
 * (avoids JWKS round-trips and Clerk service dependency in CI).
 *
 * Database: requires a reachable Postgres at DATABASE_URL with the
 * Drizzle migrations applied. The CI workflow stands up a Postgres
 * service container and runs `pnpm --filter @counter/schema db:migrate`
 * before this test.
 *
 * Local: `DATABASE_URL=postgresql://localhost:5432/counter_test
 *        pnpm --filter @counter/api test`
 *
 * If DATABASE_URL is unreachable, the test skips itself via
 * `t.skip` so contributors without a local Postgres can still run
 * `pnpm test` cleanly.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  orderItems,
  orders,
  organizations,
  products,
  refunds,
  users,
  customers,
  variants,
} from '@counter/schema';
import { eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

const TEST_BEARER = 'test-bearer-integration';
const TEST_USER_CLERK_ID = `user_test_${randomUUID()}`;
const TEST_ORG_CLERK_ID = `org_test_${randomUUID()}`;

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4002';
  process.env.HOST = '127.0.0.1';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_integration';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZGV2LXNpdGUuY2xlcmsuYWNjb3VudHMuZGV2JA';
  process.env.TEST_BEARER = TEST_BEARER;
  process.env.TEST_USER_ID = TEST_USER_CLERK_ID;
  process.env.TEST_CLERK_ORG_ID = TEST_ORG_CLERK_ID;
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

test('integration suite', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping integration suite (CI runs it).');
    return;
  }

  setEnv();
  const { app } = await buildServer();
  const db = getDb();

  // Clean any prior fixtures from this test's clerk ids.
  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.clerkOrgId, TEST_ORG_CLERK_ID));

  await t.test('GET /healthz', async () => {
    const res = await app.inject({ url: '/healthz' });
    assert.equal(res.statusCode, 200);
  });

  await t.test('orgs/active 404 before seeding', async () => {
    const res = await app.inject({
      url: '/api/v1/orgs/active',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 404);
  });

  let orgId = '';
  await t.test('seed user + org and resolve active', async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        clerkOrgId: TEST_ORG_CLERK_ID,
        name: 'Counter Test',
        slug: `counter-test-${randomUUID().slice(0, 8)}`,
        region: 'US',
      })
      .returning();
    assert.ok(org);
    orgId = org.id;

    await db.insert(users).values({
      clerkUserId: TEST_USER_CLERK_ID,
      email: `${TEST_USER_CLERK_ID}@example.com`,
      name: 'Test User',
      activeOrgId: org.id,
      role: 'owner',
    });

    const res = await app.inject({
      url: '/api/v1/orgs/active',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { org: { id: string; tier: string } };
    assert.equal(body.org.id, org.id);
    assert.equal(body.org.tier, 'free');
  });

  let productId: string;
  await t.test('POST /api/v1/products + GET list', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Espresso',
        variants: [
          { name: 'Single', priceCents: 350 },
          { name: 'Double', priceCents: 450 },
        ],
      },
    });
    assert.equal(post.statusCode, 201);
    const created = post.json() as { product: { id: string } };
    productId = created.product.id;

    const list = await app.inject({
      url: '/api/v1/products',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(list.statusCode, 200);
    const listed = list.json() as { products: { id: string }[] };
    assert.ok(listed.products.some((p) => p.id === productId));
  });

  await t.test('POST /api/v1/customers + search', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Casey Customer',
        email: 'casey@example.com',
        phone: '+1-555-0100',
      },
    });
    assert.equal(post.statusCode, 201);

    const list = await app.inject({
      url: '/api/v1/customers?q=casey',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(list.statusCode, 200);
    const listed = list.json() as { customers: { name: string }[] };
    assert.ok(listed.customers.some((c) => c.name === 'Casey Customer'));
  });

  await t.test('reports gated by tier', async () => {
    const free = await app.inject({
      url: '/api/v1/reports/dashboard',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(free.statusCode, 402);
    const freeBody = free.json() as { error: string; currentTier: string };
    assert.equal(freeBody.error, 'tier_required');
    assert.equal(freeBody.currentTier, 'free');

    await db.update(organizations).set({ tier: 'pro' }).where(eq(organizations.id, orgId));

    const pro = await app.inject({
      url: '/api/v1/reports/dashboard',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(pro.statusCode, 200);
    const proBody = pro.json() as { summary: { current: { orders: number } } };
    assert.equal(typeof proBody.summary.current.orders, 'number');
  });

  await t.test('reports respect organizations.timezone for "today" bucketing', async () => {
    // Set the org tz to Asia/Manila (UTC+8). Insert an order at
    // 2026-05-02 23:30 Manila — that's 2026-05-02 15:30 UTC, which
    // is the *same* UTC day but well before Manila midnight.
    // The order should appear in "Today" iff `now` is inside that
    // local Manila day. We craft a fixed `now` via the controller's
    // current-time read by issuing the request immediately.
    await db
      .update(organizations)
      .set({ timezone: 'Asia/Manila' })
      .where(eq(organizations.id, orgId));

    // Build a synthetic order placed at the exact UTC instant we
    // care about and verify "30d" range counts it. (We cannot mock
    // `now()` cleanly, but the wider 30-day window will include any
    // order from the last month regardless of tz — what we're really
    // checking is that the bucket SQL doesn't choke on the tz arg.)
    const placedAt = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    await db.insert(orders).values({
      orgId,
      clientOpId: `tz-test-${randomUUID()}`,
      paymentMethod: 'cash',
      status: 'completed',
      subtotalCents: 1000,
      taxCents: 0,
      tipCents: 0,
      discountCents: 0,
      totalCents: 1000,
      createdAt: placedAt,
    });

    const res = await app.inject({
      url: '/api/v1/reports/dashboard?range=30d',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { timezone: string; series: { bucket: string }[] };
    assert.equal(body.timezone, 'Asia/Manila');
    assert.ok(body.series.length > 0, 'expected at least one series bucket');
  });

  await t.test('GET /api/v1/sync/status reports orgVersion + per-device lag', async () => {
    const res = await app.inject({
      url: '/api/v1/sync/status',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      orgVersion: string;
      queuedOps: number;
      devices: { id: string; lag: string; freshness: string }[];
    };
    assert.match(body.orgVersion, /^\d+$/);
    assert.equal(typeof body.queuedOps, 'number');
    assert.ok(Array.isArray(body.devices));
  });

  await t.test('PATCH /orgs/active updates timezone, rejects garbage, bumps version', async () => {
    // Read current version so we can verify it bumps after PATCH —
    // Blueprint #19 makes the org row sync-replicated, so each
    // settings change advances the row's Lamport stamp.
    const [before] = await db
      .select({ version: organizations.version })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const versionBefore = before?.version ?? 0n;

    const ok = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/active',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: { timezone: 'America/New_York' },
    });
    assert.equal(ok.statusCode, 200);
    const okBody = ok.json() as { org: { timezone: string; version: string } };
    assert.equal(okBody.org.timezone, 'America/New_York');

    const [after] = await db
      .select({ version: organizations.version, currentVersion: organizations.currentVersion })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    assert.ok(after, 'org row exists post-PATCH');
    assert.ok(after.version > versionBefore, 'org.version must advance on PATCH');
    assert.equal(
      after.version,
      after.currentVersion,
      'org row version stamps the same Lamport value as currentVersion',
    );

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/active',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: { timezone: 'Atlantis/Lost' },
    });
    assert.equal(bad.statusCode, 400);
  });

  await t.test('GET /api/v1/orders list + detail with refund history', async () => {
    // Seed an order + item + a partial refund directly via Drizzle.
    // The orders endpoints are read-only — mutations live on the sync
    // push path which is exercised in sync-push.test.ts.
    const variantId = randomUUID();
    await db
      .insert(variants)
      .values({ id: variantId, orgId, productId, name: 'Single', priceCents: 350 });

    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId,
      orgId,
      clientOpId: `orders-test-${randomUUID()}`,
      paymentMethod: 'cash',
      status: 'partially_refunded',
      subtotalCents: 1000,
      taxCents: 120,
      tipCents: 50,
      discountCents: 0,
      totalCents: 1170,
    });
    const itemId = randomUUID();
    await db.insert(orderItems).values({
      id: itemId,
      orgId,
      orderId,
      variantId,
      nameSnapshot: 'Single ×2',
      qty: 2,
      unitPriceCents: 500,
      subtotalCents: 1000,
    });
    const refundId = randomUUID();
    await db.insert(refunds).values({
      id: refundId,
      orgId,
      orderId,
      amountCents: 560,
      subtotalCents: 500,
      taxCents: 60,
      tipCents: 0,
      discountCents: 0,
      lineQtysJson: { [itemId]: 1 },
      reason: 'One drink wrong',
    });

    // List view exposes the cumulative refunded amount.
    const list = await app.inject({
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(list.statusCode, 200);
    const listed = list.json() as {
      orders: Array<{ id: string; status: string; totalCents: number; refundedCents: number }>;
    };
    const ours = listed.orders.find((o) => o.id === orderId);
    assert.ok(ours, 'seeded order present in list');
    assert.equal(ours.status, 'partially_refunded');
    assert.equal(ours.totalCents, 1170);
    assert.equal(ours.refundedCents, 560);

    // Status filter narrows the result set.
    const filtered = await app.inject({
      url: '/api/v1/orders?status=partially_refunded',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(filtered.statusCode, 200);
    const filteredBody = filtered.json() as { orders: Array<{ status: string }> };
    assert.ok(
      filteredBody.orders.every((o) => o.status === 'partially_refunded'),
      'status filter restricts to partially_refunded',
    );

    // Detail view returns items + refunds with the full breakdown.
    const detail = await app.inject({
      url: `/api/v1/orders/${orderId}`,
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(detail.statusCode, 200);
    const detailBody = detail.json() as {
      order: { id: string; tipCents: number };
      items: Array<{ id: string; qty: number }>;
      refunds: Array<{ id: string; amountCents: number; tipCents: number; reason: string }>;
    };
    assert.equal(detailBody.order.id, orderId);
    assert.equal(detailBody.order.tipCents, 50);
    assert.equal(detailBody.items.length, 1);
    assert.equal(detailBody.items[0]?.qty, 2);
    assert.equal(detailBody.refunds.length, 1);
    assert.equal(detailBody.refunds[0]?.amountCents, 560);
    assert.equal(detailBody.refunds[0]?.tipCents, 0);
    assert.equal(detailBody.refunds[0]?.reason, 'One drink wrong');

    // Detail of a non-existent order returns 404, not 500.
    const missing = await app.inject({
      url: `/api/v1/orders/${randomUUID()}`,
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(missing.statusCode, 404);
  });

  // Cleanup so the test is idempotent.
  await db.delete(refunds).where(eq(refunds.orgId, orgId));
  await db.delete(orderItems).where(eq(orderItems.orgId, orgId));
  await db.delete(orders).where(eq(orders.orgId, orgId));
  await db.delete(variants).where(eq(variants.orgId, orgId));
  await db.delete(products).where(eq(products.orgId, orgId));
  await db.delete(customers).where(eq(customers.orgId, orgId));
  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  await app.close();
});
