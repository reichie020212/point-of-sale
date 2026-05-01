# Blueprint: PULL Upsert into WatermelonDB

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode, "sure" continue)
**Context**: HANDOFF §2 (Offline-first) & §4 (Sync Engine)

## 1. Goal

Implement the logic to persist incoming server changes (from PULL /
WS events) into the local WatermelonDB, completing the multi-device
synchronization loop.

## 2. Why this next?

It is the "read" half of the sync engine. Completing this enables the
manual test plan §4 W3 acceptance test: "write on phone A, visible on
phone B / web in < 500 ms." It transforms the mobile app from a
standalone tool into a collaborative POS.

## 3. Implementation Strategy

### Data modeling

- Model classes in `apps/mobile/src/db/models/` (`Category`,
  `Product`, `Variant`, `Modifier`, `Order`, `OrderItem`,
  `InventoryMovement`, `Customer`, `Shift`).
- Properties use camelCase; underlying SQLite columns stay snake_case
  so `_raw` access from the existing `sync_queue` stays unchanged.

### Dependency handling

- WatermelonDB tolerates dangling FKs (an `OrderItem` referring to a
  not-yet-arrived `Order` resolves once the parent lands). No
  ordering logic required in the upsert.

### Transactionality

- All changes from a single PULL chunk or WS event ride one
  `database.write()` so the UI re-renders atomically.

## 4. Execution Steps (Single Commit: `feat: implement server-to-local pull upsert`)

### Step 1 — Models

`apps/mobile/src/db/models/` — one file per model (9 total). Decorators:
`@field`, `@date`, `@readonly`, `@relation` where applicable. Models
reference the existing schema rows by `server_id`.

### Step 2 — DB init

Register the new model classes in `apps/mobile/src/db/index.ts`'s
`Database` constructor.

### Step 3 — Upsert

Replace the `console.log` stub in `apps/mobile/src/sync/upsert.ts` with
`applyServerChanges(database, table, records)`:

1. Fetch existing local rows for the given `id`s in one query.
2. Build a per-record action: `prepareCreate` / `prepareUpdate` /
   `prepareDestroyPermanently` (when `deleted_at` is set).
3. Run them in a single `database.write(() => database.batch(...))`.

Wire `client.ts` to forward PULL/EVENT records into `applyServerChanges`.

### Step 4 — Test

Unit test against a mocked `database`. Assert that the right
`prepareCreate` / `prepareUpdate` / `prepareDestroyPermanently` calls
end up in the batch for new / existing / tombstoned records.

## 5. Definition of Done

- [ ] All 9 core models defined and registered.
- [ ] `upsert.test.ts` passes for create / update / delete cases.
- [ ] Mobile build (`pnpm --filter @counter/mobile build`) clean.
- [ ] `pnpm lint` and `pnpm typecheck` clean.

## 6. Open questions resolved at execution time

- **Soft deletes**: server's `deleted_at` triggers `destroyPermanently`
  locally — the server tombstone is the final word. A "trash" feature
  would re-add the soft-delete layer locally if ever needed.
- **Initial-sync UI churn**: `database.batch` is the fastest path; we
  rely on Watermelon's reactive layer to coalesce re-renders. Bench
  if the initial 10k+ SKU pull stutters.
- **Decorator support**: Watermelon's decorators need
  `@babel/plugin-proposal-decorators` with `legacy: true`. Add to
  `apps/mobile/babel.config.js` if not already present.
