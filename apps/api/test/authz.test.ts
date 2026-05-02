/**
 * Authz / RBAC integration test (Blueprint #15).
 *
 * Verifies that the §9 RBAC matrix is enforced by `requireRole`:
 *   - cashier   → 403 on catalog mutations, 200 on catalog reads
 *   - manager   → 201/200 on catalog mutations
 *   - owner     → 201/200 on catalog mutations
 *
 * Skips when DATABASE_URL is unreachable so contributors without a
 * local Postgres still pass `pnpm test`. CI runs against a service
 * container.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { organizations, products, users, type UserRole } from '@counter/schema';
import { eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

const TEST_BEARER = 'test-bearer-authz';
const TEST_USER_CLERK_ID = `user_test_${randomUUID()}`;
const TEST_ORG_CLERK_ID = `org_test_${randomUUID()}`;

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4004';
  process.env.HOST = '127.0.0.1';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_authz';
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

test('rbac enforcement', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping authz suite (CI runs it).');
    return;
  }

  setEnv();
  const { app } = await buildServer();
  const db = getDb();

  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.clerkOrgId, TEST_ORG_CLERK_ID));

  const [org] = await db
    .insert(organizations)
    .values({
      clerkOrgId: TEST_ORG_CLERK_ID,
      name: 'RBAC Test',
      slug: `rbac-test-${randomUUID().slice(0, 8)}`,
      region: 'PH',
    })
    .returning();
  assert.ok(org);

  await db.insert(users).values({
    clerkUserId: TEST_USER_CLERK_ID,
    email: `${TEST_USER_CLERK_ID}@example.com`,
    name: 'RBAC Tester',
    activeOrgId: org.id,
    role: 'cashier',
  });

  const setRole = async (role: UserRole) => {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  };

  const postProduct = () =>
    app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: {
        name: `Espresso ${randomUUID().slice(0, 6)}`,
        variants: [{ name: 'Single', priceCents: 350 }],
      },
    });

  await t.test('cashier is blocked from POST /products with 403 role_required', async () => {
    await setRole('cashier');
    const res = await postProduct();
    assert.equal(res.statusCode, 403);
    const body = res.json() as { error: string; currentRole: string; requiredRoles: string[] };
    assert.equal(body.error, 'role_required');
    assert.equal(body.currentRole, 'cashier');
    assert.deepEqual(body.requiredRoles, ['owner', 'manager']);
  });

  await t.test('cashier can still GET /products (reads are not role-gated)', async () => {
    await setRole('cashier');
    const res = await app.inject({
      url: '/api/v1/products',
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 200);
  });

  await t.test('manager can POST /products', async () => {
    await setRole('manager');
    const res = await postProduct();
    assert.equal(res.statusCode, 201);
  });

  await t.test('owner can POST /products', async () => {
    await setRole('owner');
    const res = await postProduct();
    assert.equal(res.statusCode, 201);
  });

  await t.test('cashier is blocked from PATCH /orgs/active', async () => {
    await setRole('cashier');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orgs/active',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: { timezone: 'Asia/Manila' },
    });
    assert.equal(res.statusCode, 403);
    const body = res.json() as { error: string };
    assert.equal(body.error, 'role_required');
  });

  await t.test('cashier is blocked from POST /exports', async () => {
    await setRole('cashier');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: { entity: 'products', format: 'json' },
    });
    assert.equal(res.statusCode, 403);
  });

  // Cleanup so a re-run starts from zero.
  await db.delete(products).where(eq(products.orgId, org.id));
  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.clerkOrgId, TEST_ORG_CLERK_ID));
  await app.close();
});
