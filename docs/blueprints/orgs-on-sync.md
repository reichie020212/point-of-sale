# Blueprint: Reactive Organization Settings (Orgs-on-Sync)

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §3 (Web Dashboard) & §4 (Sync Engine) & Blueprint #19

## 1. Goal

Make the `organizations` row sync-replicated so a dashboard
tax-rate / currency / timezone edit reaches every paired register
reactively — no app restart, no REST round-trip on next boot.

## 2. Why this next?

- **Closes the reactive loop opened by #18.** The EVENT broadcast
  now carries full row data (post #18). Putting the org row on the
  sync loop means the existing fan-out delivers settings updates
  in one hop.
- **Lifts the "next boot refresh" caveat from #16.** Cart math,
  Money formatting, and receipts all read from `useOrgSettings`.
  Pre-#19, that slice only updated on app boot or device-identity
  change. Post-#19, every tax-rate / currency edit on web fans out
  to every register within a single broker hop.
- **Smallest possible schema move.** One bigint column on
  `organizations` (`version`, distinct from the existing
  `currentVersion` watermark). No new tables, no Watermelon schema
  bump.

## 3. Implementation Strategy

- **Two Lamport columns on `organizations`.** `currentVersion` is
  the per-org watermark (advances on every PUSH batch).
  `version` is the row's own stamp (advances only when the org
  row itself changes). On a PATCH the route bumps both to the
  same new value. They diverge later when downstream PUSHes only
  touch `currentVersion`.
- **`SYNC_TABLES` += `'organizations'`.** The existing PULL handler
  picks up the new entry via `SUPPORTED_PULLS`; HELLO from a
  cursor < `org.version` device emits the row.
- **`fetchRecord` += `'organizations'`.** The EVENT enrichment
  path from #18 now serializes the org row alongside the rest.
- **PATCH `/api/v1/orgs/active` is the producer.** It bumps both
  columns inside the existing `UPDATE` (one round trip), then
  publishes a `record_updated` EVENT through `app.broker`. The
  broker is now decorated on the Fastify instance at boot
  (`app.decorate('broker', broker)`) so any route can publish.
- **Mobile intercepts `'organizations'` in useSync.** A new
  `useOrgSettings.applyFromRecord(record)` action takes the
  snake_case payload and writes to the slice + persists to
  expo-secure-store. `applyServerChanges`'s allowlist for
  `'organizations'` stays empty (route never reaches it).
- **Pure helpers extracted.** `recordToSettings()` and
  `parseTaxRate()` move to `apps/mobile/src/state/org-settings-
  helpers.ts` — no RN runtime imports — so they can be unit-tested
  under plain Node without mocking expo-secure-store / Zustand.

## 4. Execution Steps (Single Commit: `feat(api,mobile): orgs-on-sync — reactive settings via EVENT`)

### Step 1 — Schema migration
`packages/schema/src/auth.ts` — add `version: bigint('version',
{ mode: 'bigint' }).notNull().default(sql`0`)` to organizations.
`pnpm db:generate` produces `drizzle/0006_reflective_spiral.sql`.

### Step 2 — Sync wiring
- `packages/sync/src/messages.ts` — `SYNC_TABLES += 'organizations'`.
- `apps/api/src/sync/handler.ts` — import `organizations`; add an
  entry to `SUPPORTED_PULLS` that emits the org row when its
  `version > cursor`.
- `apps/api/src/sync/fetch-record.ts` — add `'organizations'` case.
- `apps/mobile/src/sync/upsert.ts` — add `'organizations': []` to
  COLUMNS for type-completeness (route never reaches this path
  because useSync intercepts upstream).

### Step 3 — Server publishes EVENT on PATCH
- `apps/api/src/server.ts` — `app.decorate('broker', broker)` so
  REST routes can publish.
- `apps/api/src/routes/orgs.ts` — PATCH handler bumps
  `currentVersion + 1` and stamps the same value on `version`,
  then `app.broker.publish(orgId, { type: 'record_updated', ...,
  record: serializeRow(updated) })`.

### Step 4 — Mobile consumer
- `apps/mobile/src/state/org-settings-helpers.ts` (new) —
  `OrgSettings` interface, `DEFAULT_ORG_SETTINGS`, `parseTaxRate`,
  `recordToSettings`. Pure, no RN imports.
- `apps/mobile/src/state/org-settings.ts` — re-exports `OrgSettings`,
  uses helpers, adds `applyFromRecord(record)` action that calls
  `recordToSettings(record, current)` + persists.
- `apps/mobile/src/sync/useSync.ts` — `onRecord` intercepts
  `table === 'organizations'` and routes to
  `useOrgSettings.getState().applyFromRecord(record)` instead of
  `upsertRecord`.

### Step 5 — Tests
- `apps/api/test/integration.test.ts` — PATCH /orgs/active
  subtest reads `organizations.version` before + after, asserts
  it advances and equals `currentVersion`.
- `apps/mobile/test/org-settings-helpers.test.ts` (new) — pins
  `parseTaxRate` (percent-string → fraction, garbage → 0) and
  `recordToSettings` (full record, partial fallback, empty
  no-op, ignores camelCase bug-shape).

### Step 6 — Verify
- `pnpm typecheck` 13/13 green.
- `pnpm lint` clean.
- `pnpm build` 8/8 green.
- `pnpm --filter @counter/api test` — 27 cases, 21 pass + 6 DB-skipped.
- `pnpm --filter @counter/mobile test` — 17 cases, all pass (8 new
  org-settings-helpers cases on top of 9 prior).

## 5. Definition of Done

- [x] `organizations.version` migration generated and applied.
- [x] `SYNC_TABLES` includes `'organizations'`; SUPPORTED_PULLS
      and fetchRecord both handle it.
- [x] PATCH `/api/v1/orgs/active` bumps both Lamport columns and
      publishes a record_updated EVENT with the full record.
- [x] Mobile useSync routes the `'organizations'` EVENT to
      `useOrgSettings.applyFromRecord`; cart math sees the new
      tax rate / currency / timezone immediately.
- [x] Pure helpers extracted for unit testing; no RN imports
      pollute the test target.
- [x] Server integration test asserts version bumps; mobile
      helper unit test pins parsing contracts.
- [x] Lint, typecheck, monorepo build, API + mobile unit tests
      all green.

## 6. Open questions resolved at execution time

- **Why intercept the EVENT in useSync instead of giving
  `organizations` a Watermelon table?** Cart math already reads
  from a Zustand slice (`useOrgSettings`); adding a Watermelon
  table would mean a schema-version bump (+ migration) plus a
  bridge from the org collection back into the slice. Routing the
  EVENT directly to the slice is the smaller change with the same
  user-visible behavior. If a future surface (e.g. a "list of orgs
  the user belongs to" view) needs reactive Watermelon queries
  over orgs, that's an additive Blueprint.
- **Why bump both `currentVersion` and `version` to the same new
  value?** The mobile sync cursor compares against `org.version`
  for pull eligibility; `currentVersion` is what stamps every
  *other* row written in the same Lamport interval. Stamping both
  to the same value makes "what version is the org row at" easy
  to reason about: it's always the latest Lamport tick the org
  has seen.
- **Initial PULL on HELLO sends the org row at cursor=0.** First
  boot from a paired device gets the canonical settings before
  any catalog rows arrive. The expo-secure-store cache from #16
  still serves offline boots (or pre-WS connection cart math),
  so the PH defaults aren't relied on except on a fresh install.
- **No mobile schema-version bump.** `applyServerChanges` is
  bypassed for `'organizations'` upstream in useSync, so the
  Watermelon schema doesn't need a new table. The `COLUMNS: []`
  entry exists only for `Record<SyncTable, string[]>` type
  completeness.
- **Scope of EVENT producers:** only PATCH `/orgs/active`. POST
  `/orgs` doesn't publish because at create time no devices are
  paired yet — no subscribers to fan out to. If this changes (e.g.
  inviting an existing user to a new org), a follow-up wires that
  publish.
- **Existing `useOrgSettings.refresh()` (REST) stays.** It's the
  cold-start / re-pair path and the offline reconciliation
  fallback. The EVENT path is the live path; both keep the slice
  in sync.
