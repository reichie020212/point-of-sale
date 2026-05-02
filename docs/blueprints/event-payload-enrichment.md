# Blueprint: EVENT Payload Enrichment

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §4 (Sync Engine) & Blueprint #18

## 1. Goal

Close the last silent-correctness gap in the cross-device sync
engine: `record_updated` EVENTs now carry the full serialized row
so a receiving device applies the change in a single hop without
racing the cursor.

## 2. Why this next?

- **Real correctness fix.** Before this commit, the broker EVENT
  payload was `{type, orgId, table, id, version}`. The mobile sync
  client (`apps/mobile/src/sync/client.ts:172-176`) advances its
  cursor to `event.version` on receipt. The next reconnect HELLO
  asks for `> cursor`, which means the row that *triggered* the
  EVENT is now skipped because the cursor is already past it.
  Result: device B saw "something happened" but never the data,
  unless the initial PULL had already covered it. After this fix,
  the EVENT carries the row inline; the mobile `onRecord` handler
  routes it through `applyServerChanges` immediately, no re-PULL
  needed.
- **Latency win, too.** Cross-device propagation drops to one fan-
  out hop. No more "EVENT then PULL" round-trip.
- **Sets up orgs-on-sync.** If a future Blueprint mirrors the
  `organizations` row to mobile via the sync loop (so dashboard
  edits propagate without a manual refresh), that work would have
  needed this fix anyway. Doing it now means orgs-on-sync only has
  to add a row-level `version` column + a Watermelon model.

## 3. Implementation Strategy

- **Extend `SyncFanoutEvent`.** `record_updated` gains a required
  `record: Record<string, unknown>`. `record_deleted` is reserved
  (no current producer publishes it; soft-deletes ride through
  `record_updated` with `deleted_at` set).
- **Server fetches post-commit row.** After `processPush` returns,
  for each successful op, the handler calls `fetchRecord(db,
  table, id)` and serializes it via the existing `serializeRow`
  helper from #17 (snake_case keys, ISO timestamps, decimal-string
  bigints). The result is published to the broker alongside the
  existing fields.
- **fetchRecord is a switch over SyncTable.** Each case selects
  from the matching Drizzle table by `id`. No `isNull(deletedAt)`
  filter — soft-deleted rows still need to broadcast so receivers
  destroy their local copy. Tables not yet on the sync loop
  (`refunds`, `devices`) return `null`; the publish call falls
  back to `{id}` so EVENT delivery degrades gracefully rather
  than crashing.
- **Forward `record` to the WebSocket.** The subscribe-side handler
  no longer wraps the id in `{id: event.id}`; it forwards
  `event.record` directly into the EVENT message. The
  `EventMessage` zod schema already accepts arbitrary record
  shapes (`record: z.record(z.unknown())`), so no protocol change.
- **Tests pin the wire shape.** `broker-multi-instance.test.ts`
  and `pubsub.test.ts` now publish events with full record
  payloads; the cross-instance test asserts the record survives
  a round-trip through Redis (proving JSON.stringify/parse handles
  the new field).

## 4. Execution Steps (Single Commit: `fix(sync): include full record in EVENT broadcast`)

### Step 1 — Extend the broker event type
`apps/api/src/sync/pubsub.ts` — `record_updated` gains
`record: Record<string, unknown>`. Doc comment explains the race
condition this prevents.

### Step 2 — fetchRecord helper
New `apps/api/src/sync/fetch-record.ts`:
- `fetchRecord(db, table, id)` — switch over `SyncTable`, selects by
  id without a `deleted_at` filter so tombstones broadcast.
- Returns `null` for `refunds` / `devices` (not on the sync loop).

### Step 3 — Handler
`apps/api/src/sync/handler.ts`:
- Imports `fetchRecord` and `serializeRow`.
- PUSH branch: after each successful result, fetch the row,
  serialize, and publish with `record`.
- Subscribe handler: forwards `event.record` (or `{id}` fallback
  for the reserved `record_deleted` shape) into the EVENT WS msg.

### Step 4 — Tests
- `broker-multi-instance.test.ts`: each published event gets a
  representative record; the happy-path subtest asserts the record
  survives the wire (`got.record.org_id === orgId`,
  `got.record.name === 'Espresso'`).
- `pubsub.test.ts`: in-process round-trip events also carry
  records.

### Step 5 — Verify
- `pnpm typecheck` green across 13 packages.
- `pnpm lint` green.
- `pnpm build` green.
- `pnpm --filter @counter/api test` — 27 tests, 21 pass, 6 DB-skipped.
- (Redis-backed `broker-multi-instance.test.ts` skips locally; CI
  runs it against the Redis service container.)

## 5. Definition of Done

- [x] `SyncFanoutEvent.record_updated` carries the full record.
- [x] Server fetches + serializes the post-commit row before
      publishing; falls back to `{id}` for tables not on the loop.
- [x] WebSocket EVENT messages forward the full record to clients.
- [x] `broker-multi-instance.test.ts` asserts the record survives
      cross-instance fan-out.
- [x] `pubsub.test.ts` round-trip events include records.
- [x] Lint, typecheck, monorepo build, API unit tests all green.

## 6. Open questions resolved at execution time

- **Why a single fetch-after-commit instead of capturing the row
  inside the writer transaction?** The writers in
  `apps/api/src/sync/service.ts` are op-specific and already
  return only the id. Adding a returning clause to each writer
  would touch every writer; a post-commit `select(*) where id=?`
  is one helper, exact-canonical, and trivially type-safe. The
  extra round-trip is one indexed PK lookup per op — negligible
  next to the broker fan-out.
- **Payload size:** for typical PUSH (1–5 ops), an enriched event
  is a few KB on Redis. A 100-row CSV import would balloon, but
  imports go through the REST endpoint (`/api/v1/imports/products`),
  not the sync PUSH path. If a future workflow batches > 100 sync
  PUSHes, we revisit (likely: chunk the EVENT or fall back to
  an id-only signal that triggers a re-PULL).
- **`record_deleted` reserved, not implemented.** No current
  producer emits it; soft-deletes ride through `record_updated`
  with `deleted_at` set. The subscribe handler still has a
  fallback to `{id}` for the deleted shape so a future producer
  doesn't immediately crash receivers.
- **Tables not on the sync loop (`refunds`, `devices`):** EVENT
  publishes for these tables fall back to `{id}`. None of the
  current PUSH writers target them, so this is dead code today;
  the fallback exists so adding a new `SyncTable` member without
  updating `fetchRecord` is graceful (id-only EVENT) instead of a
  panic.
- **No new schema migration.** This commit is server-only behavior;
  the wire shape grew but the persistence layer didn't.
- **Mobile change?** None required. `applyServerChanges` already
  handles the full-record shape correctly — the snake_case
  allowlist (after #17's serializer fix) drops unknown columns
  and writes the rest. The "before #17" bug-shape is pinned by
  the sentinel test added in #17.
