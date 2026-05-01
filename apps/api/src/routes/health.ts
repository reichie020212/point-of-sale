import { sql } from 'drizzle-orm';

import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';



export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const db = getDb();
      await db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch (err) {
      app.log.error({ err }, 'readiness check failed');
      return reply.code(503).send({ status: 'not_ready' });
    }
  });
};
