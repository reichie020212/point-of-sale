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
 *   4. Server emits live EVENTs for that org as other devices PUSH
 *      (Redis pub/sub fan-out is wired in W6 — for now only the
 *      originating connection sees its own writes).
 *   5. PUSH writes are accepted with idempotency on `clientOpId` and
 *      ack'd with the canonical version. PUSH writes are stubbed in W3;
 *      M6 / M9 fill them in once the mobile client uses them.
 *
 * TODO(W6): Redis pub/sub for cross-machine event fan-out.
 */
import { verifyToken } from '@clerk/backend';
import { categories, customers, products, variants, modifiers } from '@counter/schema';
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
import { and, asc, eq, gt } from 'drizzle-orm';

import { getActiveOrg } from '../auth/org.js';
import { getDb } from '../db.js';

import type { Config } from '../config.js';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

const PULL_PAGE_SIZE = 200;

export interface SyncHandlerDeps {
  config: Config;
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

    let auth: { userId: string; sessionId: string };
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

    // Resolve active org without a real FastifyRequest — fake the auth
    // shape since getActiveOrg only reads `auth`.
    const org = await getActiveOrg({
      auth: {
        userId: auth.userId,
        sessionId: auth.sessionId,
        orgId: null,
        deviceId: auth.sessionId,
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

    let helloSeen = false;
    const pingTimer = setInterval(() => {
      try {
        ws.send(encodeServerMessage({ type: 'ping' }));
      } catch (err) {
        log.warn({ err }, 'ping failed; closing');
        ws.close();
      }
    }, 15_000);

    ws.on('close', () => {
      clearInterval(pingTimer);
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
        // TODO(M6/M9): full PUSH implementation lands with the mobile
        // sync client + cash payment flow. For now, ack each op with
        // ok:false so clients know to retry once the server is ready.
        ws.send(
          encodeServerMessage({
            type: 'ack',
            results: parsed.ops.map((op: PushOp) => ({
              clientOpId: op.clientOpId,
              ok: false,
              error: 'push_not_implemented',
            })),
          }),
        );
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
};

/** Bigint columns are JSON-stringified as decimal strings. Dates as ISO. */
function serializeRow(row: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (typeof v === 'bigint') out[k] = v.toString(10);
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

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
