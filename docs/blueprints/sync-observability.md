# Blueprint: Sync Engine Observability & Maintenance

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode, "yes")
**Context**: HANDOFF §4 (Sync Engine) & §8 (Non-negotiables)

## 1. Goal

Stop the `sync_idempotency` table from growing unbounded, and turn
the sync engine from a black box into something the dashboard can
report on. After this Blueprint a paired register's freshness and
update lag are visible per-device on the Registers page.

## 2. Why this next?

- **Operational risk**: every accepted PUSH op writes a
  `sync_idempotency` row that was never being deleted. Six months
  of production traffic would slow the per-batch idempotency
  lookup. This is the kind of thing you fix before launch, not
  after the first slow query.
- **Visibility**: until now there was no answer to "is this
  register up to date?" without raw SQL. The `lastSeenAt` on
  `devices` was set on pair, never refreshed by the sync session.
- **Closes a TODO**: the sync.ts schema docstring already promised
  "rows are kept for ~7 days … and pruned by a future maintenance
  job. The deferred prune is intentional." This is that job.

## 3. Implementation Strategy

- **Maintenance worker.** A 1-hour interval timer in the API
  process runs `DELETE FROM sync_idempotency WHERE processed_at <
  now() - 24h`. The TTL is comfortably wider than any plausible
  client retry window. The worker `unref()`s its handle so it
  doesn't keep the event loop alive at shutdown.
- **Heartbeat.** When the sync WebSocket session authenticates as
  a paired device (i.e. `auth.deviceId` is the device uuid, not a
  Clerk session id), the handler stamps `devices.last_seen_at` +
  `last_ip` on connect, and updates `last_seen_version` on HELLO
  (using the client's PULL cursor as a hint) and after every
  accepted PUSH (using the highest server version emitted in the
  ack). The version update wraps in `greatest(...)` so a flaky
  reconnect can't roll the watermark back.
- **Health route.** `GET /api/v1/sync/status` returns
  `orgVersion`, `queuedOps` (count of in-TTL idempotency rows),
  and per-device `{ lastSeenAt, lastSeenVersion, lag, lastIp,
  freshness }`. `freshness` derives from `lastSeenAt`:
  `live` (≤60s), `stale` (≤10m), `offline` (older or never).
- **Registers UI.** The dashboard merges the existing devices
  list with the sync status response and renders the lag count
  + a relative timestamp + the `freshness` pill. The pre-pairing
  state still wins (a row with `pairing_code != null` is shown
  as "pairing" regardless of the freshness derived value).

## 4. Execution Steps (Single Commit: `feat(api,web): sync engine health monitoring + idempotency pruning`)

### Step 1 — Schema
`packages/schema/src/devices.ts` — add
`lastSeenVersion: bigint('last_seen_version', { mode: 'bigint' })
  .notNull().default(sql\`0\`)`. Migration `0004_youthful_terror.sql`
adds the column to the existing table.

### Step 2 — Maintenance worker
`apps/api/src/sync/maintenance.ts` — `pruneIdempotency(db, ttl?, now?)`
returns `{ deleted }`; `startMaintenanceWorker(db, log)` wraps it in
an interval. Server boot starts the worker unless
`config.NODE_ENV === 'test'` (or the test passes
`startMaintenance: false` to `buildServer`); `onClose` stops it.

### Step 3 — Heartbeat
`apps/api/src/sync/handler.ts` — capture `request.ip` on session
open, stamp `last_seen_at`/`last_ip` immediately when authed as a
paired device. Wire `heartbeat(deviceId, version)` into the HELLO
and PUSH paths. `greatest(...)` keeps the watermark monotonic.

### Step 4 — Health route
`apps/api/src/routes/sync.ts` — read the org's `current_version`,
count in-TTL `sync_idempotency` rows, list devices, compute lag
and freshness, sort by name. Tier-gated to `pro/business`.

### Step 5 — Registers UI
`apps/web/app/(dashboard)/dashboard/registers/page.tsx` — fetch
`/api/v1/devices` and `/api/v1/sync/status` in parallel, merge by
id, render `Last seen / Lag / Last IP` per row. The header now
shows org version + queued op count. New `formatRelative()` helper
turns the ISO timestamp into "5m ago" / "1h ago".

### Step 6 — Tests
`apps/api/test/maintenance.test.ts` — insert one stale + one
fresh idempotency row, run `pruneIdempotency`, assert the stale
row is gone and the fresh one survives. Auto-skips without
`DATABASE_URL`.
`apps/api/test/integration.test.ts` — new sub-test asserts
`/api/v1/sync/status` returns `orgVersion`, `queuedOps`,
`devices`.

## 5. Definition of Done

- [x] Migration `0004_youthful_terror.sql` adds
      `devices.last_seen_version`.
- [x] Maintenance worker prunes idempotency rows older than 24h
      on a 1h cadence.
- [x] HELLO + accepted PUSH both heartbeat the device row.
- [x] `/api/v1/sync/status` returns org version + queue depth
      + per-device lag/freshness.
- [x] Registers page renders lag + relative last-seen + freshness
      pill per device.
- [x] `pnpm lint` + `pnpm typecheck` + mobile build + web build
      all green. Maintenance + sync-status tests added.

## 6. Open questions resolved at execution time

- **Retention window**: 24 hours. Wide margin over any client
  retry, and the row-level Lamport version columns dedupe on the
  storage path regardless. Flagged in the worker docstring; the
  constant is exported so a future Blueprint can tune it without
  a hot patch.
- **Multi-instance prune**: every API instance runs the worker on
  its own timer. The DELETE is idempotent and the index makes it
  cheap; we do not coordinate via a leader-election lock. If the
  fleet ever has hundreds of API pods this becomes wasteful and
  we can move it to a dedicated cron pod.
- **Heartbeat for Clerk-token sync sessions**: skipped. Web
  dashboards open sync sessions for live broker fan-out but
  there's no `devices` row to stamp; the `if (deviceId)` guard
  short-circuits cleanly.
- **`last_seen_version` direction**: monotonic via
  `greatest(last_seen_version, ${new})`. A reconnect with a
  rewound cursor (e.g., user wiped the local DB) won't lower the
  watermark; the device gets a fresh PULL and the watermark
  catches up.
