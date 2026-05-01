/**
 * Local sync queue — FIFO over the WatermelonDB `sync_queue` table.
 *
 * Durable: rows live in SQLite, so an offline-only sale survives an app
 * kill, a phone reboot, or a process crash. Drained rows are deleted
 * only after the server returns ok=true; on ok=false we keep the row,
 * bump `attempts`, and stash `last_error`. This is the contract the
 * SyncClient relies on to satisfy HANDOFF §2.3 ("offline-first or
 * nothing").
 *
 * Fields mirror @counter/sync's PushOp:
 *   - clientOpId  — stable identifier for server-side idempotency
 *   - table       — sync table name
 *   - payload     — the row to upsert (JSON-encoded for storage)
 *   - asDelta     — true only for inventory_movements (delta-CRDT)
 */
import { Q } from '@nozbe/watermelondb';

import { database } from '../db';

import type { SyncTable } from '@counter/sync';
import type { Model } from '@nozbe/watermelondb';

export interface QueuedOp {
  clientOpId: string;
  table: SyncTable;
  payload: Record<string, unknown>;
  asDelta: boolean;
}

interface QueueRow extends Model {
  client_op_id: string;
  table_name: string;
  payload_json: string;
  as_delta: boolean;
  created_at: number;
  attempts: number;
  last_error: string | null;
}

const TABLE = 'sync_queue';

function row(record: Model): QueueRow {
  // WatermelonDB exposes columns via a typed accessor that we don't
  // model classes for yet (master Blueprint M5 follow-up). Fall back to
  // the raw underscore properties — `_raw` carries the snake_case row.
  return (record as unknown as { _raw: QueueRow })._raw;
}

export async function enqueue(op: QueuedOp): Promise<void> {
  await database.write(async () => {
    await database.get(TABLE).create((record) => {
      const r = row(record);
      r.client_op_id = op.clientOpId;
      r.table_name = op.table;
      r.payload_json = JSON.stringify(op.payload);
      r.as_delta = op.asDelta;
      r.created_at = Date.now();
      r.attempts = 0;
      r.last_error = null;
    });
  });
}

export async function drain(limit = 50): Promise<QueuedOp[]> {
  const rows = await database
    .get(TABLE)
    .query(Q.sortBy('created_at', Q.asc), Q.take(limit))
    .fetch();
  return rows.map((record) => {
    const r = row(record);
    return {
      clientOpId: r.client_op_id,
      table: r.table_name as SyncTable,
      payload: JSON.parse(r.payload_json) as Record<string, unknown>,
      asDelta: r.as_delta,
    };
  });
}

async function findByClientOpId(clientOpId: string): Promise<Model | null> {
  const rows = await database
    .get(TABLE)
    .query(Q.where('client_op_id', clientOpId), Q.take(1))
    .fetch();
  return rows[0] ?? null;
}

export async function markAcked(clientOpId: string): Promise<void> {
  const record = await findByClientOpId(clientOpId);
  if (!record) return;
  await database.write(async () => {
    await record.destroyPermanently();
  });
}

export async function markFailed(clientOpId: string, error: string): Promise<void> {
  const record = await findByClientOpId(clientOpId);
  if (!record) return;
  await database.write(async () => {
    await record.update((r) => {
      const raw = row(r);
      raw.attempts += 1;
      raw.last_error = error;
    });
  });
}

/** Test-only — wipe the queue between cases. Production code never calls this. */
export async function __resetQueueForTests(): Promise<void> {
  const rows = await database.get(TABLE).query().fetch();
  await database.write(async () => {
    await Promise.all(rows.map((r) => r.destroyPermanently()));
  });
}
