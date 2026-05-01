/**
 * Wire protocol for the Counter sync channel.
 *
 * Transport: WebSocket (`wss://sync.counter.app`), one connection per
 * device. HTTPS long-poll fallback (HANDOFF §4) is not modelled here —
 * the message shapes are transport-agnostic and the long-poll endpoint
 * just batches the same payloads.
 *
 * Cursor semantics: a Lamport bigint per org. Server bumps it on every
 * mutation; clients keep their last-seen value and pass it back on
 * reconnect via `HELLO.cursor`. The PULL response streams everything
 * with `version > cursor`, including tombstoned rows for the 30-day
 * window (HANDOFF §4).
 *
 * Bigint is serialized as a string on the wire because JSON has no
 * native bigint type. Helpers in `./codec` handle the conversion.
 */
import { z } from 'zod';

/** Sync-replicated tables. Keep in lockstep with packages/schema. */
export const SYNC_TABLES = [
  'categories',
  'products',
  'variants',
  'modifiers',
  'inventory_movements',
  'customers',
  'orders',
  'order_items',
  'refunds',
  'shifts',
  'devices',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

const VersionString = z.string().regex(/^\d+$/, 'version must be a base-10 bigint string');

/** Client → server: opens a sync session. */
export const HelloMessage = z.object({
  type: z.literal('hello'),
  deviceId: z.string().min(1),
  /** Bigint cursor as decimal string. `'0'` for a fresh client. */
  cursor: VersionString,
  /** Subscribe to events for these tables only; empty = all. */
  tables: z.array(z.enum(SYNC_TABLES)).default([]),
});

/** Server → client: PULL chunk; emitted multiple times until `done` is true. */
export const PullMessage = z.object({
  type: z.literal('pull'),
  table: z.enum(SYNC_TABLES),
  records: z.array(z.record(z.unknown())),
  /** Highest version seen in this chunk; clients advance their cursor. */
  cursor: VersionString,
  done: z.boolean(),
});

const PushOp = z.object({
  /** Client-stable id; survives retries. */
  clientOpId: z.string().min(1),
  table: z.enum(SYNC_TABLES),
  /** Field set varies by table; server validates against schema. */
  data: z.record(z.unknown()),
  /**
   * For inventory_movements only: the server treats the row as a delta
   * (CRDT) and never overwrites. For LWW tables this is ignored.
   */
  asDelta: z.boolean().default(false),
});

/** Client → server: bulk write. */
export const PushMessage = z.object({
  type: z.literal('push'),
  ops: z.array(PushOp).min(1),
});

/** Server → client: confirms a PUSH; reports canonical id + version per op. */
export const AckMessage = z.object({
  type: z.literal('ack'),
  results: z.array(
    z.object({
      clientOpId: z.string(),
      ok: z.boolean(),
      id: z.string().uuid().optional(),
      version: VersionString.optional(),
      error: z.string().optional(),
    }),
  ),
});

/** Server → client: live event from another device's PUSH. */
export const EventMessage = z.object({
  type: z.literal('event'),
  table: z.enum(SYNC_TABLES),
  record: z.record(z.unknown()),
  cursor: VersionString,
});

/** Server → client: ping; ping back with pong to keep the channel hot. */
export const PingMessage = z.object({ type: z.literal('ping') });
export const PongMessage = z.object({ type: z.literal('pong') });

/** Server → client: terminal error. */
export const ErrorMessage = z.object({
  type: z.literal('error'),
  code: z.enum([
    'unauthorized',
    'tier_required',
    'invalid_message',
    'rate_limited',
    'server_error',
  ]),
  message: z.string(),
});

export const ServerToClient = z.discriminatedUnion('type', [
  PullMessage,
  AckMessage,
  EventMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
]);

export const ClientToServer = z.discriminatedUnion('type', [
  HelloMessage,
  PushMessage,
  PingMessage,
  PongMessage,
]);

export type Hello = z.infer<typeof HelloMessage>;
export type Pull = z.infer<typeof PullMessage>;
export type Push = z.infer<typeof PushMessage>;
export type PushOp = z.infer<typeof PushOp>;
export type Ack = z.infer<typeof AckMessage>;
export type SyncEvent = z.infer<typeof EventMessage>;
export type Ping = z.infer<typeof PingMessage>;
export type Pong = z.infer<typeof PongMessage>;
export type SyncError = z.infer<typeof ErrorMessage>;
export type ServerMessage = z.infer<typeof ServerToClient>;
export type ClientMessage = z.infer<typeof ClientToServer>;
