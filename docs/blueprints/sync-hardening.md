# Blueprint: Sync & Build Hardening

**Status**: Completed — landed 2026-05-01
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-01 (auto mode, "continue with the project")
**Context**: HANDOFF §2 (Offline-first rules) & §4 (Sync engine)

## 1. Goal

Transition the sync engine from "functional prototype" to "production-grade
foundation" by ensuring data durability on mobile and horizontal scalability
on the backend.

## 2. Why this next?

- **Durability**: Currently, if a user makes an offline sale and the app
  crashes before sync, the sale is lost (violates HANDOFF §2.3).
- **Scalability**: The API currently only notifies devices connected to the
  same process. Redis Pub/Sub is required for multi-instance deployments
  (Fly.io/Railway).
- **Verification**: Fixing the Expo build allows the team to actually test
  on physical hardware, which is required for upcoming BLE/Stripe work.

## 3. Order of Operations (Single Commit: `feat: durable sync and build hardening`)

### Mobile: Build Integrity

- Fix `expo-build-properties` resolution in `apps/mobile/app.json`. Ensure
  the package is in devDependencies and the `plugins` array is correctly
  structured for the bare workflow.
- Verification: `pnpm --filter @counter/mobile build` (running
  `expo export`) passes in CI.

### Mobile: Durable sync_queue

- Add a `sync_queue` table to the WatermelonDB schema:
  - `table_name` (string)
  - `record_id` (string)
  - `op` (string: `create` | `update` | `delete`)
  - `payload` (string, JSON blob)
  - `created_at` (number)
- Refactor the SyncClient to read from this table instead of the in-memory
  `PendingOp[]` array. Operations are deleted only after a successful `ACK`
  from the server.

### API: Redis Sync Fan-out

- Implement Redis Pub/Sub in `apps/api/src/sync/pubsub.ts`.
- Update the WebSocket handler:
  - On `PUSH` success: `publish(orgId, { type: 'record_updated', ... })`.
  - On Connection: Subscribe to `orgId` channel and push events to the
    client.

## 4. Definition of Done

- [ ] `expo export` completes without errors (or fails with a different,
      device-only error documented in the manual test plan).
- [ ] Mobile sync_queue is a WatermelonDB table; operations survive an
      app kill (manual verification — out of CI per HANDOFF §10).
- [ ] Redis Pub/Sub broadcasts sync events across API instances; covered
      by an integration test that boots two server instances in-process
      and confirms an event from instance A reaches a connection on B.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter @counter/api test`
      all clean.
- [ ] No hardcoded colors/fonts (existing lint rule).

## 5. Open Questions resolved at execution time (auto mode)

- **Redis Provider**: One Redis instance shared between rate limiting and
  sync pub/sub. A single `REDIS_URL` env var. Confirmed reasonable for
  small-shop deploys.
- **Timezone**: Out of scope for this commit. The `organizations.timezone`
  column lands as a separate small commit afterward; scope here is
  durability + fan-out only.

## 6. Out of scope

- Real device manual verification of the durable queue (HANDOFF §10
  accepted "no device runtime in CI").
- Production Redis sizing / clustering. The pubsub module uses ioredis
  defaults; production tuning is a separate ops concern.
- Switching the existing in-memory rate-limit store onto Redis (current
  build has no rate limiter — a TODO for later).
