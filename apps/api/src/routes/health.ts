import { sql } from 'drizzle-orm';

import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

/**
 * Liveness + readiness probes (k8s-style separation):
 *  - /healthz: process is up. Returns 200 unless the API is in a
 *    fundamentally broken state. Uptime monitors poll this to decide
 *    "is the container alive?".
 *  - /readyz: dependencies are reachable. Pings Postgres and the
 *    pub/sub broker. Returns 503 with a per-dep status when any one
 *    is unreachable so the load balancer / health-check system can
 *    pull the instance out of rotation without killing it.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'down'> = { db: 'ok', broker: 'ok' };
    let allOk = true;

    try {
      const db = getDb();
      await db.execute(sql`select 1`);
    } catch (err) {
      app.log.error({ err }, 'readiness check: db unreachable');
      checks.db = 'down';
      allOk = false;
    }

    try {
      await app.broker.ping();
    } catch (err) {
      app.log.error({ err }, 'readiness check: broker unreachable');
      checks.broker = 'down';
      allOk = false;
    }

    if (!allOk) return reply.code(503).send({ status: 'not_ready', checks });
    return { status: 'ready', checks };
  });
};
