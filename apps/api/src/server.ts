/**
 * Counter API entrypoint.
 *
 * Boot order:
 *   1. parse + validate config
 *   2. init DB connection (postgres-js + Drizzle)
 *   3. register CORS, Clerk auth plugin, and route plugins
 *   4. listen
 *
 * BigInt serialization: Drizzle returns Postgres bigint columns as
 * native JS BigInt (e.g. `version`, `current_version`). JSON.stringify
 * throws on bigint by default; we install a global `toJSON` returning
 * the decimal string. Wire compatibility — clients already parse
 * cursors as decimal strings (see @counter/sync VersionString).
 */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function toJSON(this: bigint): string {
  return this.toString();
};

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';

import { clerkAuthPlugin } from './auth/clerk.js';
import { loadConfig } from './config.js';
import { initDb, getDb } from './db.js';
import { authRoutes } from './routes/auth.js';
import { categoryRoutes } from './routes/categories.js';
import { customerRoutes } from './routes/customers.js';
import { deviceRoutes } from './routes/devices.js';
import { exportRoutes } from './routes/exports.js';
import { healthRoutes } from './routes/health.js';
import { importRoutes } from './routes/imports.js';
import { loyaltyRoutes } from './routes/loyalty.js';
import { orgRoutes } from './routes/orgs.js';
import { productRoutes } from './routes/products.js';
import { reportRoutes } from './routes/reports.js';
import { syncRoutes } from './routes/sync.js';
import { registerSyncHandler } from './sync/handler.js';
import { startMaintenanceWorker, type MaintenanceWorker } from './sync/maintenance.js';
import { createBroker, type Broker } from './sync/pubsub.js';

import type { ClerkClient } from '@clerk/backend';

declare module 'fastify' {
  interface FastifyInstance {
    clerk: ClerkClient;
    broker: Broker;
  }
}

export interface BuildServerOptions {
  /**
   * Override the pub/sub broker. Tests pass a shared InProcessBroker so
   * two `buildServer()` calls in the same process can fan-out to each
   * other without needing Redis. Production / dev rely on the default,
   * which inspects `REDIS_URL`.
   */
  broker?: Broker;
  /**
   * Disable the background sync_idempotency prune worker. Tests pass
   * `false` so they can drive `pruneIdempotency` directly without a
   * timer racing them. Production / dev leave it on.
   */
  startMaintenance?: boolean;
}

export async function buildServer(opts: BuildServerOptions = {}) {
  const config = loadConfig();
  initDb(config.DATABASE_URL);
  const broker = opts.broker ?? createBroker(config.REDIS_URL);
  const ownsBroker = !opts.broker;

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        config.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
    },
    trustProxy: true,
    disableRequestLogging: false,
  });

  app.decorate('broker', broker);

  await app.register(cors, { origin: config.CORS_ORIGINS, credentials: true });
  await app.register(websocket);
  await app.register(clerkAuthPlugin, { config });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(orgRoutes);
  await app.register(categoryRoutes);
  await app.register(productRoutes);
  await app.register(customerRoutes);
  await app.register(deviceRoutes);
  await app.register(reportRoutes);
  await app.register(importRoutes);
  await app.register(exportRoutes);
  await app.register(loyaltyRoutes);
  await app.register(syncRoutes);
  registerSyncHandler(app, { config, broker });

  let maintenance: MaintenanceWorker | null = null;
  if (opts.startMaintenance ?? config.NODE_ENV !== 'test') {
    maintenance = startMaintenanceWorker(getDb(), app.log);
  }

  app.addHook('onClose', async () => {
    maintenance?.stop();
    if (ownsBroker) await broker.close();
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, 'unhandled error');
    if (reply.sent) return;
    reply.code(err.statusCode ?? 500).send({
      error: err.name ?? 'internal_error',
      message: config.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    });
  });

  return { app, config };
}

async function main() {
  const { app, config } = await buildServer();
  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
