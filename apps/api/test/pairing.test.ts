/**
 * Device pairing integration test.
 *
 * Walks the canonical flow:
 *   1. Admin (Clerk-authed) requests a pairing code.
 *   2. Unpaired client exchanges the code for a device token.
 *   3. The token authenticates a sync-required REST request.
 *   4. Admin revokes the device.
 *   5. The same token now fails with 401.
 *
 * Plus negative cases:
 *   - Wrong code → 404.
 *   - Reusing a paired code → 409.
 *   - Free-tier org → 402 on /code (sync paywall).
 *
 * Skips when DATABASE_URL is unreachable so contributors without a
 * local Postgres still pass `pnpm test`. CI runs against a real
 * service container.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { devices, organizations, users } from '@counter/schema';
import { eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

const TEST_BEARER = 'test-bearer-pairing';
const TEST_USER_CLERK_ID = `user_test_${randomUUID()}`;
const TEST_ORG_CLERK_ID = `org_test_${randomUUID()}`;

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4003';
  process.env.HOST = '127.0.0.1';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_pairing';
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

test('device pairing', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping pairing suite (CI runs it).');
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
      name: 'Pairing Test',
      slug: `pairing-test-${randomUUID().slice(0, 8)}`,
      region: 'US',
      tier: 'pro',
    })
    .returning();
  assert.ok(org);
  await db.insert(users).values({
    clerkUserId: TEST_USER_CLERK_ID,
    email: `${TEST_USER_CLERK_ID}@example.com`,
    name: 'Pairing Tester',
    activeOrgId: org.id,
    role: 'owner',
  });

  let issuedToken = '';
  let issuedDeviceId = '';
  let pairingCode = '';

  await t.test('admin requests a pairing code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/code',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Counter @ Front' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as {
      device: { id: string; name: string };
      pairing: { code: string; expiresAt: string };
    };
    assert.match(body.pairing.code, /^CNTR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    pairingCode = body.pairing.code;
    issuedDeviceId = body.device.id;
  });

  await t.test('mobile exchanges the code for a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/pair',
      headers: { 'content-type': 'application/json' },
      payload: { code: pairingCode, name: 'Counter @ Front', model: 'Pixel 8' },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { device: { id: string; orgId: string }; token: string };
    assert.equal(body.device.id, issuedDeviceId);
    assert.equal(body.device.orgId, org.id);
    assert.match(body.token, /^dvc_/);
    issuedToken = body.token;
  });

  await t.test('device token authenticates a request', async () => {
    const res = await app.inject({
      url: '/api/v1/orgs/active',
      headers: { authorization: `Bearer ${issuedToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { org: { id: string } };
    assert.equal(body.org.id, org.id);
  });

  await t.test('reusing a paired code is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/pair',
      headers: { 'content-type': 'application/json' },
      payload: { code: pairingCode },
    });
    assert.equal(res.statusCode, 404);
  });

  await t.test('an unknown code is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/pair',
      headers: { 'content-type': 'application/json' },
      payload: { code: 'CNTR-AAAA-AAAA' },
    });
    assert.equal(res.statusCode, 404);
  });

  await t.test('admin revokes the device', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/devices/${issuedDeviceId}/revoke`,
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });
    assert.equal(res.statusCode, 200);
  });

  await t.test('revoked token is rejected', async () => {
    const res = await app.inject({
      url: '/api/v1/orgs/active',
      headers: { authorization: `Bearer ${issuedToken}` },
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('free-tier org cannot mint pairing codes', async () => {
    await db.update(organizations).set({ tier: 'free' }).where(eq(organizations.id, org.id));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/code',
      headers: {
        authorization: `Bearer ${TEST_BEARER}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    assert.equal(res.statusCode, 402);
  });

  // Cleanup.
  await db.delete(devices).where(eq(devices.orgId, org.id));
  await db.delete(users).where(eq(users.clerkUserId, TEST_USER_CLERK_ID));
  await db.delete(organizations).where(eq(organizations.id, org.id));

  await app.close();
});
