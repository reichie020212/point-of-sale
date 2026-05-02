# Blueprint: Sync Serializer Casing Fix + PH Onboarding

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §4 (Sync Engine), §9 (PH region), Blueprint #17

## 1. Goal

Fix the latent key-casing mismatch between the API's PULL response
and the mobile client's `applyServerChanges`, surface PH as a region
option in onboarding, and bootstrap region-appropriate
currency/tax-rate defaults at org creation time.

## 2. Why this next?

- **Real correctness fix.** `apps/api/src/sync/handler.ts`
  `serializeRow` was emitting Drizzle's camelCase JS keys
  (`orgId`, `priceCents`, `updatedAt`). The mobile
  `apps/mobile/src/sync/upsert.ts` has a snake_case column allowlist
  (`org_id`, `price_cents`, `updated_at`). Cross-device PULL was
  silently dropping every column except `id` and `deleted_at`. The
  symptom would be: device A creates a product, device B sees the
  row appear via PULL but every field reads as null/empty.
- **Why nothing caught it before:** the mobile `upsert.test.ts`
  feeds snake_case directly without going through the API
  serializer; the broker fan-out test inspects broker payloads
  (which only carry `{id, version}`, not full rows); no end-to-end
  "two clients, one server" PULL integration test existed.
- **Tiny prerequisite for orgs-on-sync.** A future Blueprint that
  puts `organizations` on the WatermelonDB sync loop would have
  inherited this same bug. Fixing it now means that follow-up just
  needs a row-level `version` column + a Watermelon model — no
  protocol surgery.
- **Onboarding had a gap from #15.** The `region` enum got `'PH'`
  in #15, but `apps/web/app/onboarding/page.tsx` and its server
  action still only offered US/EU. Adding PH (defaulted, since v1
  is PH-only) closes that gap. Once PH is selectable, the org's
  currency + tax_rate need to follow region — otherwise a US shop
  would inherit the schema's PHP / 12.000 defaults, which is wrong.

## 3. Implementation Strategy

- **Extract the serializer into its own util module** so it gets
  unit-tested directly. `apps/api/src/util/serialize.ts` exports
  `toSnakeCase` and `serializeRow`. The handler imports it.
- **Conversion is shallow.** Only top-level keys are renamed. JSONB
  values (e.g. `modifiers_json`) pass through untouched — the
  mobile `coerce()` already handles them as opaque.
- **`toSnakeCase` is regex-based and idempotent.** It transforms
  `orgId → org_id`, `clientOpId → client_op_id`, leaves
  `org_id`/`id`/`deleted_at` unchanged. Digits are preserved
  (`s3Url → s3_url`).
- **Bug-shape sentinel test on the mobile side.** A dedicated case
  in `upsert.test.ts` asserts that camelCase keys (the pre-fix
  payload shape) are filtered out by the snake_case allowlist.
  Pinning this means a server-side regression that reverts to
  camelCase wouldn't pass undetected — the new API serializer test
  fails first, but if it's somehow disabled the mobile test also
  catches it.
- **PH onboarding.** Region picker now offers `PH (Philippines)`
  with `ap-southeast • ₱` subtitle, US, EU. PH is the new default
  since §9 declared PH-only launch. The form action's zod accepts
  `'PH'` so the server doesn't reject it.
- **Region-driven org defaults.** `POST /api/v1/orgs` no longer
  relies on the schema column defaults (which were calibrated for
  PH). It maps `region` → `{currency, taxRate}` explicitly:
  PH → `PHP / 12.000`, US → `USD / 0.000`, EU → `EUR / 0.000`. The
  schema defaults still apply for fixtures that don't go through
  this path (existing test seeds use `region: 'US'` and now
  silently get a sensible USD/0% bootstrap if they leave the new
  columns to default — but every fixture inserts both columns
  explicitly, so this is invariant only for live POST /orgs).

## 4. Execution Steps (Single Commit: `fix(api,web): sync serializer casing + PH onboarding`)

### Step 1 — Extract + fix `serializeRow`
- New `apps/api/src/util/serialize.ts` exporting `toSnakeCase` and
  `serializeRow`.
- `apps/api/src/sync/handler.ts` imports `serializeRow` from
  `../util/serialize.js` and removes the inline definition.

### Step 2 — Unit test
- New `apps/api/test/serialize.test.ts`:
  - `toSnakeCase` cases: camelCase → snake_case, idempotent on
    snake_case, preserves digits.
  - `serializeRow` cases: renames camelCase keys, bigint → decimal
    string, Date → ISO, scalars + JSONB blobs untouched, idempotent
    on already-snake_case rows. Asserts no leftover camelCase keys
    (the bug-shape canary).

### Step 3 — Mobile bug-shape sentinel
- `apps/mobile/test/upsert.test.ts` gains
  `'drops camelCase keys (bug-shape sentinel for the snake_case
  allowlist)'`. Demonstrates that even if the API regressed and
  emitted camelCase, the mobile would silently store nothing
  (which is the symptom we just fixed at the source).

### Step 4 — PH onboarding option + region defaults
- `apps/web/app/onboarding/actions.ts` — zod region enum gains
  `'PH'`.
- `apps/web/app/onboarding/page.tsx` — `RegionPicker` renders three
  options with PH defaulted; grid widens to `sm:grid-cols-3`.
- `apps/api/src/routes/orgs.ts` — POST handler maps
  `region` → `{currency, taxRate}` and inserts them explicitly
  alongside the existing fields. PH gets the §9 PHP/12.000;
  US/EU get USD/0.000 and EUR/0.000.

### Step 5 — Verify
- `pnpm typecheck` — all 13 packages green.
- `pnpm lint` — green.
- `pnpm build` — monorepo green.
- `pnpm --filter @counter/api test` — 27 tests, 21 pass, 6 DB-skipped.
- `pnpm --filter @counter/mobile test` — 9 tests, all pass.

## 5. Definition of Done

- [x] `toSnakeCase` and `serializeRow` extracted into a util module
      with full unit coverage.
- [x] `serializeRow` no longer leaks camelCase keys onto the wire.
- [x] Mobile upsert test pins the snake_case allowlist behavior
      against future regressions.
- [x] Onboarding region picker includes PH (defaulted) and the
      server action accepts it.
- [x] `POST /api/v1/orgs` sets currency + tax_rate from region at
      creation time so a US/EU shop doesn't inherit PH defaults.
- [x] Lint, typecheck, monorepo build, API + mobile unit tests all
      green.

## 6. Open questions resolved at execution time

- **Why not write a real cross-device WebSocket integration test?**
  Considered. Rejected for this commit because (a) `serializeRow` is
  the only point at which casing can drift; unit-testing it pins the
  contract more cheaply than booting two server instances + two WS
  clients. (b) The broker EVENT message currently only carries
  `{id, version}`, not row data — so a multi-instance test would not
  exercise the casing fix anyway; only PULL responses do, and a PULL
  integration test is a single-instance affair. (c) A real
  cross-device test belongs with the orgs-on-sync Blueprint where
  the EVENT payload may need to carry full row data to avoid the
  "advance cursor past unread row" race noted below.
- **Adjacent EVENT-payload race noted, not fixed:** when the broker
  delivers an EVENT, the mobile cursor advances to `event.version`
  but the EVENT only carries `{id}`. The next reconnect's HELLO
  asks for `> cursor`, so the row that triggered the EVENT is
  skipped entirely; mobile would only ever see the row's data if
  the device PULLed before the EVENT arrived. This is independent
  of the casing fix and warrants its own targeted Blueprint
  (likely: have the server include row data in EVENT messages or
  defer cursor advance until a re-PULL fetches full data).
- **Region-driven defaults are minimal.** PH/USD/EUR with
  zero-or-§9 tax rates. Multi-rate sales tax (US states), VAT
  variance (EU member countries), or zero-rated PH exempt classes
  all stay deferred per §9. Owners can refine post-onboarding via
  `/dashboard/settings` (the tax editor lands in #16; the currency
  editor stays read-only).
- **PH is now the onboarding default.** §9 declared PH-only launch;
  defaulting the radio matches that. US/EU stay selectable for
  fixture compatibility and future expansion.
