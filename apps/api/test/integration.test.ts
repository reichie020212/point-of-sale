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

import { organizations, products, users, customers, variants } from '@counter/schema';
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

  // Cleanup so the test is idempotent.
  await db.delete(variants).where(eq(variants.orgId, orgId));
  await db.delete(products).where(eq(products.orgId, orgId));
  await db.delete(customers).where(eq(customers.orgId, orgId));
  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  await app.close();
});
