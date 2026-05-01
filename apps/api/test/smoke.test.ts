/**
 * API self-boot smoke test.
 *
 * Boots the Fastify server with placeholder env, hits /healthz on a
 * random port, and asserts the response shape. The DB connection is
 * created lazily by postgres-js, so this passes without a live Postgres.
 *
 * Run: `pnpm --filter @counter/api test`
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildServer } from '../src/server.js';

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4001';
  process.env.HOST = '127.0.0.1';
  process.env.DATABASE_URL = 'postgresql://localhost:5432/counter_smoke';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_smoke';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder_smoke';
}

test('GET /healthz returns ok', async () => {
  setEnv();
  const { app } = await buildServer();
  try {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { status: string; uptime: number };
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
  } finally {
    await app.close();
  }
});

test('GET /api/v1/orgs without auth returns 401', async () => {
  setEnv();
  const { app } = await buildServer();
  try {
    const res = await app.inject({ method: 'GET', url: '/api/v1/orgs' });
    assert.equal(res.statusCode, 401);
    const body = res.json() as { error: string };
    assert.equal(body.error, 'missing_authorization');
  } finally {
    await app.close();
  }
});
