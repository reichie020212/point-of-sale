/**
 * Sync maintenance worker.
 *
 * Prunes the `sync_idempotency` table on a slow timer (default 1h)
 * so it doesn't grow unbounded. Rows older than `IDEMPOTENCY_TTL_MS`
 * are safe to drop: the mobile client never retries an op that old,
 * and the row-level Lamport version columns continue to deduplicate
 * concurrent writes regardless.
 *
 * Single-instance friendly: in a multi-instance deployment all
 * instances run this in parallel; the DELETE is idempotent and the
 * cost is trivial because of `sync_idempotency_processed_at_idx`.
 *
 * The worker is a plain `setInterval` loop. Tests skip the timer and
 * call `pruneIdempotency()` directly.
 */
import { syncIdempotency } from '@counter/schema';
import { lt } from 'drizzle-orm';

import type { getDb } from '../db.js';
import type { FastifyBaseLogger } from 'fastify';

/** Rows older than this are pruned. 24 hours leaves a wide margin
 *  over any plausible client retry window. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** How often the worker fires. Lower than the TTL so we always have
 *  at most one TTL window of dead rows hanging around. */
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

export interface MaintenanceWorker {
  stop: () => void;
}

export interface PruneResult {
  deleted: number;
}

/**
 * Delete idempotency rows whose `processed_at` is older than the
 * TTL. Returns the number of rows removed.
 */
export async function pruneIdempotency(
  db: ReturnType<typeof getDb>,
  ttlMs: number = IDEMPOTENCY_TTL_MS,
  now: Date = new Date(),
): Promise<PruneResult> {
  const cutoff = new Date(now.getTime() - ttlMs);
  const result = await db
    .delete(syncIdempotency)
    .where(lt(syncIdempotency.processedAt, cutoff))
    .returning({ orgId: syncIdempotency.orgId });
  return { deleted: result.length };
}

/**
 * Start the maintenance worker. Returns a handle whose `stop()`
 * clears the timer (called from the Fastify `onClose` hook).
 *
 * The first run fires immediately so a fresh boot doesn't sit on a
 * stale table for an hour before the first sweep.
 */
export function startMaintenanceWorker(
  db: ReturnType<typeof getDb>,
  log: FastifyBaseLogger,
  intervalMs: number = MAINTENANCE_INTERVAL_MS,
): MaintenanceWorker {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const { deleted } = await pruneIdempotency(db);
      if (deleted > 0) {
        log.info({ deleted, table: 'sync_idempotency' }, 'pruned idempotency rows');
      } else {
        log.debug({ table: 'sync_idempotency' }, 'idempotency prune: nothing to do');
      }
    } catch (err) {
      // Logged, not thrown — a maintenance failure must not crash
      // the API. The next interval will retry.
      log.warn({ err }, 'idempotency prune failed');
    }
  };

  // Fire-and-forget the first tick.
  void tick();
  const handle = setInterval(() => void tick(), intervalMs);
  // Don't keep the event loop alive just for this timer.
  if (typeof handle.unref === 'function') handle.unref();

  return {
    stop: () => {
      stopped = true;
      clearInterval(handle);
    },
  };
}
