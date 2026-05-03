/**
 * WebSocket sync handler — server side of the protocol defined in
 * @counter/sync.
 *
 * Lifecycle:
 *   1. Client connects with a Bearer token in the Sec-WebSocket-Protocol
 *      header (Clerk JWT). We verify it the same way the REST routes do.
 *   2. Client sends HELLO with deviceId + cursor.
 *   3. Server PULLs every record where version > cursor for each
 *      sync-replicated table, in batches of `PULL_PAGE_SIZE`. Tombstones
 *      ride along for HANDOFF's 30-day window.
 *   4. Server emits live EVENTs for that org via the pub/sub broker
 *      (`./pubsub.ts`). In a multi-instance deployment the broker is
 *      Redis; in a single-instance dev/test boot it's an in-process
 *      EventEmitter.
 *   5. PUSH writes are accepted with idempotency on `clientOpId` and
 *      ack'd with the canonical version. PUSH writes are stubbed in W3;
 *      M6 / M9 fill them in once the mobile client uses them.
 */
import { verifyToken } from '@clerk/backend';
import {
  categories,
  customers,
  devices,
  inventoryMovements,
  orderItems,
  orders,
  organizations,
  products,
  refunds,
  shifts,
  variants,
  modifiers,
} from '@counter/schema';
import {
  SYNC_TABLES,
  cursorFromString,
  cursorToString,
  decodeClientMessage,
  encodeServerMessage,
  type Hello,
  type PushOp,
  type SyncTable,
} from '@counter/sync';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';

import { hashDeviceToken, isDeviceToken } from '../auth/device-token.js';
import { getActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';
import { serializeRow } from '../util/serialize.js';

import { fetchRecord } from './fetch-record.js';
import { processPush } from './service.js';

import type { Broker } from './pubsub.js';
import type { Config } from '../config.js';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

const PULL_PAGE_SIZE = 200;

export interface SyncHandlerDeps {
  config: Config;
  broker: Broker;
}

export function registerSyncHandler(app: FastifyInstance, deps: SyncHandlerDeps) {
  app.get('/sync', { websocket: true }, async (socket, request) => {
    const ws = socket as unknown as WebSocket;
    const log = request.log.child({ component: 'sync' });

    // Auth: token from `Authorization: Bearer ...` (most clients) or
    // from the `?token=` query param (browser WebSocket cannot set
    // arbitrary headers). We accept both for development convenience.
    const token = extractToken(request);
    if (!token) {
      ws.send(
        encodeServerMessage({
          type: 'error',
          code: 'unauthorized',
          message: 'Bearer token required',
        }),
      );
      ws.close();
      return;
    }

    let auth: { userId: string; sessionId: string; deviceOrgId?: string; deviceId?: string };
    if (isDeviceToken(token)) {
      const db = getDb();
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.tokenHash, hashDeviceToken(token)), isNull(devices.deletedAt)))
        .limit(1);
      if (!device || device.status === 'revoked') {
        ws.send(
          encodeServerMessage({
            type: 'error',
            code: 'unauthorized',
            message: 'Device token revoked or unknown',
          }),
        );
        ws.close();
        return;
      }
      auth = {
        userId: `device:${device.id}`,
        sessionId: `device:${device.id}`,
        deviceOrgId: device.orgId,
        deviceId: device.id,
      };
    } else {
      try {
        const verified = await verifyToken(token, { secretKey: deps.config.CLERK_SECRET_KEY });
        if (!verified.sub || !verified.sid) throw new Error('missing claims');
        auth = { userId: verified.sub, sessionId: verified.sid };
      } catch (err) {
        log.warn({ err }, 'sync token verification failed');
        ws.send(
          encodeServerMessage({
            type: 'error',
            code: 'unauthorized',
            message: 'Token verification failed',
          }),
        );
        ws.close();
        return;
      }
    }

    // Resolve active org without a real FastifyRequest — fake the auth
    // shape since getActiveOrg only reads `auth`.
    const org = await getActiveOrg({
      auth: {
        userId: auth.userId,
        sessionId: auth.sessionId,
        orgId: null,
        deviceId: auth.deviceId ?? auth.sessionId,
        deviceOrgId: auth.deviceOrgId,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (!org) {
      ws.send(
        encodeServerMessage({
          type: 'error',
          code: 'unauthorized',
          message: 'No active organization',
        }),
      );
      ws.close();
      return;
    }

    if (org.tier === 'free') {
      ws.send(
        encodeServerMessage({
          type: 'error',
          code: 'tier_required',
          message: 'Sync requires a Pro or Business plan',
        }),
      );
      ws.close();
      return;
    }

    log.info({ orgId: org.id, userId: auth.userId, tier: org.tier }, 'sync session opened');

    // Heartbeat: when the session authenticated as a paired device,
    // stamp `last_seen_at`/`last_ip` immediately. last_seen_version
    // gets bumped on HELLO (using the cursor) and after every accepted
    // PUSH. Clerk-token sessions skip this — no `devices` row to point
    // at.
    const deviceId = auth.deviceId;
    const remoteIp =
      typeof request.ip === 'string' ? request.ip : null;
    if (deviceId) {
      try {
        await getDb()
          .update(devices)
          .set({
            lastSeenAt: new Date(),
            ...(remoteIp ? { lastIp: remoteIp } : {}),
          })
          .where(eq(devices.id, deviceId));
      } catch (err) {
        log.warn({ err }, 'heartbeat (open) failed');
      }
    }

    let helloSeen = false;
    const pingTimer = setInterval(() => {
      try {
        ws.send(encodeServerMessage({ type: 'ping' }));
      } catch (err) {
        log.warn({ err }, 'ping failed; closing');
        ws.close();
      }
    }, 15_000);

    const unsubscribe = await deps.broker.subscribe(org.id, (event) => {
      try {
        // record_updated carries the full serialized row (Blueprint
        // #18). record_deleted is reserved and not currently emitted;
        // fall back to {id} if a future producer publishes one.
        const record =
          event.type === 'record_updated' ? event.record : { id: event.id };
        ws.send(
          encodeServerMessage({
            type: 'event',
            table: event.table as SyncTable,
            record,
            cursor: event.version,
          }),
        );
      } catch (err) {
        log.warn({ err }, 'fanout send failed');
      }
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
      void unsubscribe();
      log.info({ orgId: org.id }, 'sync session closed');
    });

    ws.on('message', async (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.concat(Array.isArray(raw) ? raw : [Buffer.from(raw as ArrayBuffer)]).toString('utf8');
      let parsed;
      try {
        parsed = decodeClientMessage(text);
      } catch (err) {
        log.warn({ err, text: text.slice(0, 200) }, 'invalid client message');
        ws.send(
          encodeServerMessage({
            type: 'error',
            code: 'invalid_message',
            message: err instanceof Error ? err.message : 'parse failure',
          }),
        );
        return;
      }

      if (parsed.type === 'pong') return;
      if (parsed.type === 'ping') {
        ws.send(encodeServerMessage({ type: 'pong' }));
        return;
      }
      if (parsed.type === 'hello') {
        helloSeen = true;
        await handleHello(ws, org.id, parsed);
        if (deviceId) {
          try {
            await heartbeat(deviceId, cursorFromString(parsed.cursor));
          } catch (err) {
            log.warn({ err }, 'heartbeat (hello) failed');
          }
        }
        return;
      }
      if (parsed.type === 'push') {
        if (!helloSeen) {
          ws.send(
            encodeServerMessage({
              type: 'error',
              code: 'invalid_message',
              message: 'must HELLO before PUSH',
            }),
          );
          return;
        }
        try {
          const results = await processPush({
            db: getDb(),
            orgId: org.id,
            ops: parsed.ops.map((op: PushOp) => ({
              clientOpId: op.clientOpId,
              table: op.table,
              data: op.data,
              asDelta: op.asDelta,
            })),
          });
          ws.send(encodeServerMessage({ type: 'ack', results }));
          let highestVersion: bigint = 0n;
          for (const result of results) {
            if (!result.ok || !result.id || !result.version) continue;
            const v = cursorFromString(result.version);
            if (v > highestVersion) highestVersion = v;
            const op = parsed.ops.find((o: PushOp) => o.clientOpId === result.clientOpId);
            if (!op) continue;
            // Fetch + serialize the canonical post-commit row so the
            // EVENT broadcast carries the full data — receivers apply
            // the change in one hop instead of having to re-PULL after
            // the cursor advances. fetchRecord returns null for tables
            // not on the sync loop; the {id} fallback keeps EVENT
            // delivery working in that degraded shape.
            const row = await fetchRecord(getDb(), op.table, result.id);
            const record = row ? serializeRow(row) : { id: result.id };
            await deps.broker.publish(org.id, {
              type: 'record_updated',
              orgId: org.id,
              table: op.table,
              id: result.id,
              version: result.version,
              record,
            });

            // A refund mutation also flips the parent order's
            // `status` (paid → partially_refunded / refunded) inside
            // the same transaction. Emit a second EVENT for the order
            // row so other devices see the status change without
            // waiting for the next PULL.
            if (op.table === 'refunds' && row) {
              const orderId = (row as { orderId?: unknown }).orderId;
              if (typeof orderId === 'string' && orderId.length > 0) {
                const orderRow = await fetchRecord(getDb(), 'orders', orderId);
                if (orderRow) {
                  await deps.broker.publish(org.id, {
                    type: 'record_updated',
                    orgId: org.id,
                    table: 'orders',
                    id: orderId,
                    version: result.version,
                    record: serializeRow(orderRow),
                  });
                }
              }
            }
          }
          if (deviceId && highestVersion > 0n) {
            try {
              await heartbeat(deviceId, highestVersion);
            } catch (err) {
              log.warn({ err }, 'heartbeat (push) failed');
            }
          }
        } catch (err) {
          log.error({ err }, 'push processing failed');
          ws.send(
            encodeServerMessage({
              type: 'ack',
              results: parsed.ops.map((op: PushOp) => ({
                clientOpId: op.clientOpId,
                ok: false,
                error: err instanceof Error ? err.message : 'server_error',
              })),
            }),
          );
        }
      }
    });
  });
}

async function handleHello(ws: WebSocket, orgId: string, hello: Hello) {
  const db = getDb();
  const cursor = cursorFromString(hello.cursor);
  const requestedTables = hello.tables.length === 0 ? [...SYNC_TABLES] : hello.tables;

  for (const table of requestedTables) {
    await pullTable(ws, db, orgId, table, cursor);
  }
}

/**
 * Stamp `devices.last_seen_at` + monotonic `last_seen_version`. The
 * version is wrapped in `greatest(...)` so an old HELLO can't roll
 * the watermark back during a flaky reconnect.
 */
async function heartbeat(deviceId: string, version: bigint): Promise<void> {
  await getDb()
    .update(devices)
    .set({
      lastSeenAt: new Date(),
      lastSeenVersion: sql`greatest(${devices.lastSeenVersion}, ${version})`,
    })
    .where(eq(devices.id, deviceId));
}

async function pullTable(
  ws: WebSocket,
  db: ReturnType<typeof getDb>,
  orgId: string,
  table: SyncTable,
  cursor: bigint,
) {
  // Only the catalog tables are wired up in W3; the rest land as M5/M6/M9
  // expand the read paths. The sync layer is intentionally narrow at this
  // point — it proves the protocol works end-to-end and gives the mobile
  // client something to talk to.
  const handler = SUPPORTED_PULLS[table];
  if (!handler) {
    ws.send(
      encodeServerMessage({
        type: 'pull',
        table,
        records: [],
        cursor: cursorToString(cursor),
        done: true,
      }),
    );
    return;
  }

  let lastVersion = cursor;
  // Pages until exhausted.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await handler(db, orgId, lastVersion);
    if (rows.length === 0) {
      ws.send(
        encodeServerMessage({
          type: 'pull',
          table,
          records: [],
          cursor: cursorToString(lastVersion),
          done: true,
        }),
      );
      return;
    }
    const last = rows[rows.length - 1] as { version: bigint };
    lastVersion = last.version;
    const records = rows.map(serializeRow);
    ws.send(
      encodeServerMessage({
        type: 'pull',
        table,
        records,
        cursor: cursorToString(lastVersion),
        done: rows.length < PULL_PAGE_SIZE,
      }),
    );
    if (rows.length < PULL_PAGE_SIZE) return;
  }
}

const SUPPORTED_PULLS: Partial<
  Record<SyncTable, (db: ReturnType<typeof getDb>, orgId: string, cursor: bigint) => Promise<unknown[]>>
> = {
  categories: (db, orgId, cursor) =>
    db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), gt(categories.version, cursor)))
      .orderBy(asc(categories.version))
      .limit(PULL_PAGE_SIZE),
  products: (db, orgId, cursor) =>
    db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), gt(products.version, cursor)))
      .orderBy(asc(products.version))
      .limit(PULL_PAGE_SIZE),
  variants: (db, orgId, cursor) =>
    db
      .select()
      .from(variants)
      .where(and(eq(variants.orgId, orgId), gt(variants.version, cursor)))
      .orderBy(asc(variants.version))
      .limit(PULL_PAGE_SIZE),
  modifiers: (db, orgId, cursor) =>
    db
      .select()
      .from(modifiers)
      .where(and(eq(modifiers.orgId, orgId), gt(modifiers.version, cursor)))
      .orderBy(asc(modifiers.version))
      .limit(PULL_PAGE_SIZE),
  customers: (db, orgId, cursor) =>
    db
      .select()
      .from(customers)
      .where(and(eq(customers.orgId, orgId), gt(customers.version, cursor)))
      .orderBy(asc(customers.version))
      .limit(PULL_PAGE_SIZE),
  orders: (db, orgId, cursor) =>
    db
      .select()
      .from(orders)
      .where(and(eq(orders.orgId, orgId), gt(orders.version, cursor)))
      .orderBy(asc(orders.version))
      .limit(PULL_PAGE_SIZE),
  order_items: (db, orgId, cursor) =>
    db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orgId, orgId), gt(orderItems.version, cursor)))
      .orderBy(asc(orderItems.version))
      .limit(PULL_PAGE_SIZE),
  refunds: (db, orgId, cursor) =>
    db
      .select()
      .from(refunds)
      .where(and(eq(refunds.orgId, orgId), gt(refunds.version, cursor)))
      .orderBy(asc(refunds.version))
      .limit(PULL_PAGE_SIZE),
  inventory_movements: (db, orgId, cursor) =>
    db
      .select()
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.orgId, orgId), gt(inventoryMovements.version, cursor)))
      .orderBy(asc(inventoryMovements.version))
      .limit(PULL_PAGE_SIZE),
  shifts: (db, orgId, cursor) =>
    db
      .select()
      .from(shifts)
      .where(and(eq(shifts.orgId, orgId), gt(shifts.version, cursor)))
      .orderBy(asc(shifts.version))
      .limit(PULL_PAGE_SIZE),
  // The org row is one-row-per-device-session; emit it on HELLO if
  // its `version` is ahead of the device's cursor. This is what
  // makes tax-rate / currency / timezone edits flow to mobile
  // without needing a REST round-trip.
  organizations: (db, orgId, cursor) =>
    db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, orgId), gt(organizations.version, cursor)))
      .orderBy(asc(organizations.version))
      .limit(PULL_PAGE_SIZE),
};

function extractToken(request: { headers: Record<string, string | string[] | undefined>; query: unknown }): string | null {
  const headers = request.headers;
  const auth = headers.authorization ?? headers.Authorization;
  if (typeof auth === 'string') {
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) return token;
  }
  const q = request.query as { token?: string } | undefined;
  return q?.token ?? null;
}
