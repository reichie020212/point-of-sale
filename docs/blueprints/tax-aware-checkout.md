# Blueprint: Tax-Aware Checkout & Settings UI

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §9 (PH region policies) & Blueprint #16

## 1. Goal

Wire the `organizations.tax_rate` + `organizations.currency` columns
that landed in #15 into product behavior on both surfaces:
- Web `/dashboard/settings` exposes an editable tax-rate field; the
  currency is rendered read-only because v1 is PH-locked per §9.
- Mobile cart math reads the active org's rate at checkout, persists
  the cached value to expo-secure-store so an offline register still
  sells with the right tax, and pulls fresh values when paired or on
  next boot.
- Receipts and the payment-screen totals format money with the org's
  currency.

## 2. Why this next?

- Closes the gap between #15's schema work and user-visible behavior.
  Without this, `tax_rate` is a column nobody reads and the cart
  hard-codes a placeholder 8.25% US rate that breaks PH receipts.
- Smallest §9 follow-up that touches all three surfaces (API, web,
  mobile) — exercises the full end-to-end loop without needing a new
  schema migration or sync-protocol change.
- Sets up the Money component to default to per-org currency, which
  every future surface (refunds, billing, reports) will need.

## 3. Implementation Strategy

- **API**: Extend `PatchOrgBody` with `taxRate` (numeric percent
  string, regex `^\d{1,2}(\.\d{1,3})?$`, range 0–99.999) and
  `currency` (3-letter ISO 4217). Both optional; the existing
  "at least one field required" refine still applies.
- **Web**: New `TaxRateSettings` client component, structured exactly
  like `TimezoneSettings` (Clerk token via `useAuth().getToken()`,
  PATCH to `/api/v1/orgs/active`, `router.refresh()` on success).
  Settings page adds a "Tax rate" section + a read-only "Currency"
  row in the Identity dl. Slug + region + currency are pinned at
  sign-up per the explanatory copy.
- **Mobile**: New `useOrgSettings` Zustand slice persisted to
  expo-secure-store under `counter.orgSettings`. Mirrors the
  `useDevice` pattern: `hydrate()` reads cached values on boot,
  `refresh()` calls `GET /api/v1/orgs/active` (device-token auth) and
  re-persists on success. Defaults: `taxRate: 0.12, currency: 'PHP',
  timezone: 'UTC'` — guarantees the cart always has a usable rate
  even on a fresh install before the first network call. The slice
  exposes the rate as a *fraction* (0.12), not a percent (12),
  because the cart math is `subtotal * fraction = tax_cents`.
- **Mobile boot wiring**: `_layout.tsx` calls `hydrateOrgSettings`
  unconditionally on mount and `refreshOrgSettings` whenever
  `useDevice.identity` is set. A 401 from the refresh deletes the
  cached settings and resets to defaults so a stale rate from a
  prior pairing doesn't leak across re-pairs.
- **Cart math**: `payment.tsx` reads `taxRate` from the slice;
  `Math.round(subtotal * taxRate)` is the tax line. The "Tax" row
  in the totals card and on the receipt still gates on `> 0` so
  zero-tax exemptions don't render an empty line.
- **Money formatting**: `Money` defaults the ISO currency code to
  `useOrgSettings.settings.currency` if no `currency` prop is passed.
  Existing call sites with explicit `currency` keep working.
- **Receipt formatter**: `packages/printers/src/format.ts` reads
  `order.currency` (new optional field on `ReceiptOrder`) instead of
  hard-coded `USD`; falls back to `'PHP'` if a caller omits it. The
  `Intl.NumberFormat` is now built per-call instead of module-scope
  so multiple orgs with different currencies render correctly.

## 4. Execution Steps (Single Commit: `feat(api,web,mobile): tax-aware checkout + settings UI`)

### Step 1 — API zod
`apps/api/src/routes/orgs.ts` — `TaxRate` + `Currency` zod schemas;
`PatchOrgBody` gets both as optional fields.

### Step 2 — Web settings UI
- New `apps/web/components/TaxRateSettings.tsx` (client component).
- Update `apps/web/app/(dashboard)/dashboard/settings/page.tsx`:
  - Identity section now displays Currency (read-only).
  - New "Tax rate" section at the bottom, rendered above any future
    billing section.
  - `ActiveOrg` interface includes `currency: string` and
    `taxRate: string` and the new `'PH'` region literal.

### Step 3 — Mobile API + slice
- `apps/mobile/src/api/client.ts` — new `apiCalls.getActiveOrg()`
  returning `ActiveOrgSummary` with `taxRate` + `currency` strings.
- New `apps/mobile/src/state/org-settings.ts` — Zustand slice with
  `settings`, `ready`, `hydrate()`, `refresh()`. Defaults to PH
  values. Cached as JSON in expo-secure-store under
  `counter.orgSettings`.

### Step 4 — Boot wiring
`apps/mobile/app/_layout.tsx` — three new effects: hydrate on mount,
refresh whenever `useDevice.identity` changes, log no-op otherwise.

### Step 5 — Cart + Money + receipt
- `apps/mobile/app/payment.tsx`:
  - Drop the `0.0825` placeholder + its TODO comment.
  - Read `taxRate` and `currency` from the slice.
  - Stamp `currency` onto the `ReceiptOrder`.
- `apps/mobile/src/components/Money.tsx`:
  - `currency` prop now optional; defaults to `useOrgSettings`.
- `packages/printers/src/types.ts` — `ReceiptOrder.currency?: string`.
- `packages/printers/src/format.ts` — currency Intl formatter is now
  per-call from `order.currency ?? 'PHP'`.

### Step 6 — Verify
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter
  @counter/api test`, `pnpm --filter @counter/mobile test` — all
  green. DB-backed tests skip locally without Postgres; CI runs
  them.

## 5. Definition of Done

- [x] PATCH `/api/v1/orgs/active` accepts `taxRate` and `currency`
      with strict validation; existing timezone path untouched.
- [x] Web settings page renders the new tax-rate form and the
      read-only currency row alongside the existing timezone form.
- [x] Mobile boot fetches the active org via device-token auth and
      caches `tax_rate` + `currency` in expo-secure-store.
- [x] Cart total at checkout uses the configured rate; receipt
      shows the right tax line in JetBrains Mono with the right
      currency symbol.
- [x] Money component defaults to org currency; explicit overrides
      still honored.
- [x] Receipt formatter no longer hard-codes USD; an order with
      `currency: 'PHP'` renders ₱ amounts.
- [x] Lint, typecheck, monorepo build, mobile + API unit tests all
      green.

## 6. Open questions resolved at execution time

- **Currency editability:** read-only in v1. §9 declared PH-only;
  a multi-region launch would change the *region's* currency, not
  let an operator switch their PH org to USD mid-life. The schema
  remains flexible so a future "transfer org region" Blueprint can
  flip it server-side.
- **Tax line on zero-rated sales:** still hidden when `taxCents ===
  0`. PH compliance for thermal receipts may eventually require an
  itemized "VAT 0%" line for zero-rated goods, but the printer
  layout is already a TODO (HANDOFF §3 / `format.ts` policy comment)
  and the registers are still going through MockPrinter in v1.
- **Why not put org settings on the sync loop:** the WatermelonDB
  sync engine is currently for the catalog/customers/orders set;
  adding the `organizations` table requires a row-level `version`
  column (separate from the existing per-org Lamport `current_version`
  watermark), a new Watermelon model, and an update to
  `apps/mobile/src/sync/upsert.ts`. That's a separate Blueprint
  (orgs-on-sync) with its own DB migration and protocol change. v1
  pulls fresh settings on identity change + boot; an operator who
  edits the rate from the dashboard sees the next register pick it
  up after the next refresh.
- **Default tax rate fallback:** 0.12 (12% PH VAT) baked into the
  Zustand slice. Defaults exist for the boot-before-first-refresh
  window only; once `refresh()` succeeds the cached value is the
  source of truth.
- **401 handling on refresh:** clears cached settings and resets to
  defaults, so a re-pair against a different org doesn't carry over
  stale tax rate. Other failures (offline, 5xx) keep the existing
  cache so the register stays usable.
- **Latent serializer-casing bug noticed during exploration:** the
  API's `serializeRow` in `apps/api/src/sync/handler.ts` emits
  Drizzle's camelCase JS keys (e.g. `orgId`) but mobile's
  `applyServerChanges` expects snake_case (e.g. `org_id`). Cross-
  device PULL of catalog/customer rows likely silently drops most
  fields except `id` + `deleted_at`. **Not fixed in this Blueprint**
  — it's an independent issue that needs its own targeted fix and
  end-to-end test. Flagged in `counter-pos-resume.md` for a
  follow-up.
