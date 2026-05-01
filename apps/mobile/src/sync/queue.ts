/**
 * Local sync queue — FIFO over the WatermelonDB `sync_queue` table.
 *
 * **Implementation status**: in-memory stub for M6. The shape of this
 * module is the durable contract; the SQLite-backed implementation
 * lands once Watermelon model classes do (a few of them block on real
 * device runtime testing — see master Blueprint §10 Out-of-Scope).
 *
 * The fields mirror @counter/sync's PushOp:
 *   - clientOpId  — stable identifier the server uses for idempotency
 *   - table       — sync table name
 *   - payload     — the row to upsert
 *   - asDelta     — true only for inventory_movements (delta-CRDT)
 */
import type { SyncTable } from '@counter/sync';

export interface QueuedOp {
  clientOpId: string;
  table: SyncTable;
  payload: Record<string, unknown>;
  asDelta: boolean;
}

interface InternalEntry extends QueuedOp {
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const memory = new Map<string, InternalEntry>();

export async function enqueue(op: QueuedOp): Promise<void> {
  memory.set(op.clientOpId, { ...op, createdAt: Date.now(), attempts: 0 });
  return Promise.resolve();
}

export async function drain(limit = 50): Promise<QueuedOp[]> {
  const all = [...memory.values()].sort((a, b) => a.createdAt - b.createdAt);
  return Promise.resolve(
    all.slice(0, limit).map(({ clientOpId, table, payload, asDelta }) => ({
      clientOpId,
      table,
      payload,
      asDelta,
    })),
  );
}

export async function markAcked(clientOpId: string): Promise<void> {
  memory.delete(clientOpId);
  return Promise.resolve();
}

export async function markFailed(clientOpId: string, error: string): Promise<void> {
  const entry = memory.get(clientOpId);
  if (!entry) return Promise.resolve();
  entry.attempts += 1;
  entry.lastError = error;
  return Promise.resolve();
}

/** TODO(M6 follow-up): test-only export until Watermelon-backed impl lands. */
export function __resetQueueForTests(): void {
  memory.clear();
}
