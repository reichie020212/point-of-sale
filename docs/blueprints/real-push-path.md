# Blueprint: Real PUSH Path (Mobile-to-Server)

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-01 (auto mode, "yes" continue)
**Context**: HANDOFF §4 (Sync Engine) & §2 (Offline-first)

## 1. Goal

Implement the server-side logic to accept, persist, and broadcast data
pushed from mobile devices, ensuring data integrity via transactions
and idempotency.

## 2. Why this next?

It is the "Point of No Return" for the offline-first architecture.
Without a real PUSH path, the mobile app is a data silo. This unblocks
the Week 3 acceptance test from `docs/manual-test-plan.md` §4: "Write
on phone, visible on web in < 500 ms."

## 3. Implementation Details

### Versioning (Lamport Clock)

A single `current_version` counter per `organization`. Every successful
PUSH batch increments this counter. All records created/updated in that
batch receive the _new_ version number.

### Idempotency

Clients generate a `client_op_id` (UUID) per mutation. The server
tracks `(orgId, clientOpId)` in a `sync_idempotency` table to prevent
duplicate processing of retried requests.

### Supported Tables

`orders`, `order_items`, `inventory_movements`, `customers`,
`products`, `variants`, `categories`, `shifts`. Catalog tables are
upsert-on-id; sales tables are insert-only after first write.

## 4. Execution Steps (Single Commit: `feat: implement idempotent sync push path`)

### Step 1: Schema Updates

- `auth.ts`: add `currentVersion` (bigint, default 0) to
  `organizations`.
- new `sync.ts`: `sync_idempotency` table with composite primary key
  `(org_id, client_op_id)`, plus `processed_at`.
- `db:generate` to emit the SQL migration.

### Step 2: Sync Service

`apps/api/src/sync/service.ts` — `processPush({ orgId, deviceId, ops })`:

1. Open a DB transaction.
2. Look up the set of `clientOpId`s already in `sync_idempotency` for
   this org.
3. If any new ops remain, increment `organizations.currentVersion`
   once and read the new value.
4. For each new op, upsert the row into the target table with
   `version = newVersion`, then insert into `sync_idempotency`.
5. Commit.
6. Return per-op result: `{ clientOpId, ok, id?, version?, error? }`.
   Replays return `ok: true` without a version.

### Step 3: WebSocket Handler

Replace the `push_not_implemented` stub in `apps/api/src/sync/handler.ts`
with a call to the service. On success, iterate through results and
`broker.publish(orgId, ...)` per persisted row. Reply with the
`AckMessage` payload exactly as the protocol expects.

### Step 4: Integration Test

`apps/api/test/sync-push.test.ts` (DB-required, auto-skip otherwise):

- Drive a multi-table PUSH (order + 2 order_items) via the service
  directly (avoids needing a real WS client in tests).
- Assert rows persisted, `organizations.current_version` advanced,
  three `broker.publish` calls observed via an injected stub broker.
- Replay the same batch — expect ok:true everywhere with no new
  inserts and no version bump.

## 5. Definition of Done

- [ ] Migration generated and applied via `db:migrate`.
- [ ] sync-push integration test passes (skipped only when no DB).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter @counter/api test`
      and `pnpm build` clean.

## 6. Open questions resolved at execution time

- **Inventory `onHand`**: PUSH treats `inventory_movements` as
  append-only. The `onHand` cache stays computed-on-read for now;
  triggers/views land in a separate milestone.
- **Soft deletes**: standard PUSH upsert handles `deletedAt`.
- **Bigint defaults**: per the resume notes, drizzle-kit 0.24 chokes
  on `0n` literals in column defaults. Use `sql\`0\``for`currentVersion`.
