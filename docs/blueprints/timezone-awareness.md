# Blueprint: Organization Timezone Awareness

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode, "continue")
**Context**: HANDOFF §3 (Web Dashboard) & §5 (Backend Reports)

## 1. Goal

Move every dashboard report from UTC bucketing to the shop's local
timezone. "Today" tracks the operator's calendar day; the daily/hour
chart bins align with local opening hours.

## 2. Why this next?

The UTC bucketing was a documented `TODO(timezone)` in the reports
route since W3. For any shop east or west of UTC the "Today" pill
flipped over before or after their actual close — exactly the
regression a small-shop owner would notice first. This Blueprint
deletes that TODO.

It also unblocks future, less-obvious work: shift open/close ledgers,
end-of-day cash counts, and anything that depends on the concept
"this calendar day" all read from the same column now.

## 3. Implementation Strategy

- **Storage**: a single `organizations.timezone TEXT NOT NULL DEFAULT
  'UTC'` column. IANA names (`America/New_York`, `Asia/Manila`).
  Default `UTC` so existing rows stay valid; onboarding picks the
  operator's browser tz via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Aggregation**: Postgres 16's three-arg `date_trunc(field, source,
  time_zone)` does the bucket truncation; results are still
  `timestamp with time zone` aligned to the same UTC instant. No
  client-side date math.
- **JS-side window math**: a small helper `startOfLocalDay(now, tz)`
  computes "the most-recent local midnight in `tz` that is `<= now`,
  expressed as UTC". Used to build the `WHERE created_at >= start`
  bound for the "today" range. No external dep — Node 20's `Intl`
  knows every IANA zone we ship.
- **Validation**: `isValidTimezone(tz)` constructively tests the name
  through `Intl.DateTimeFormat`. Used by the Zod schemas for both
  `POST /orgs` and `PATCH /orgs/active`.
- **No external picker library**: the onboarding form and the new
  settings page both use `Intl.supportedValuesOf('timeZone')` for the
  zone list. Keeps the bundle lean.

## 4. Execution Steps (Single Commit: `feat(api,web): organization timezone awareness`)

### Step 1 — Schema
`packages/schema/src/auth.ts` — add the `timezone` column with a
sensible default. `pnpm --filter @counter/schema db:generate`
emits `drizzle/0003_swift_darkhawk.sql`.

### Step 2 — Helpers
`apps/api/src/util/timezone.ts` — `isValidTimezone`,
`startOfLocalDay`, `addDays`. Pure functions, easy to unit test.

### Step 3 — Reports
`apps/api/src/routes/reports.ts` — `windowFor(range, now, tz)` uses
`startOfLocalDay` for "today"; the bucket SQL passes `tz` to
`date_trunc(..., $tz)`. Response payload now echoes the resolved
`timezone` so the dashboard can label its axes.

### Step 4 — Orgs API
`apps/api/src/routes/orgs.ts` — `POST /api/v1/orgs` accepts an
optional `timezone`; new `PATCH /api/v1/orgs/active` updates it.
Both routes validate against `isValidTimezone`.

### Step 5 — Web onboarding
`apps/web/app/onboarding/page.tsx` — `<TimezoneField>` defaults to
`Intl.DateTimeFormat().resolvedOptions().timeZone` and renders the
full IANA zone list when supported. Form action forwards the value
to the API.

### Step 6 — Web settings page
`apps/web/app/(dashboard)/dashboard/settings/page.tsx` — new SSR
page reading `/api/v1/orgs/active` and rendering the read-only
identity card plus a `<TimezoneSettings>` client form that PATCHes
`/api/v1/orgs/active`. Dashboard nav gains the Settings link.

### Step 7 — Tests
`apps/api/test/timezone.test.ts` — pure unit tests for the helper
across UTC, EDT, Manila, and the "tomorrow-locally" boundary case.
`apps/api/test/integration.test.ts` — two new sub-tests:
   - reports include `timezone: 'Asia/Manila'` and a non-empty
     series after switching the org's tz;
   - `PATCH /orgs/active` accepts `America/New_York`, rejects
     `Atlantis/Lost`.

## 5. Definition of Done

- [x] Migration `0003_swift_darkhawk.sql` adds the `timezone`
      column without breaking existing rows.
- [x] Reports route uses 3-arg `date_trunc` and returns the
      resolved timezone in the response.
- [x] Onboarding captures the browser tz by default; settings page
      lets admins update it.
- [x] `pnpm lint`, `pnpm typecheck`, mobile build, web build all
      green. 7 timezone unit tests pass.

## 6. Open questions resolved at execution time

- **Historical data**: existing orders are re-bucketed retroactively
  the moment the org's tz changes. For a shop switching from UTC to
  EDT, yesterday's chart shifts by 4 hours — a one-time visual jolt,
  but the alternative (snapshotting per-order tz) introduces the
  problem of two charts disagreeing about which day a sale belongs
  to. We took the simpler path and flag the visual jolt here.
- **No `moment-timezone`**: native `Intl` covers everything we need.
  The app bundles stay small; the onboarding picker is just a
  `<select>` over `Intl.supportedValuesOf('timeZone')`.
- **Settings nav**: the dashboard layout previously linked nothing
  except the home page. The Settings page landing surfaced an
  obvious gap, so this commit also adds the
  Products/Customers/Registers/Settings nav links.
- **Sliding 7d/30d/90d window**: kept the existing semantics
  (`now - N*24h`), only the "today" boundary became tz-aware. Local-
  calendar-day windows for the longer ranges would be a separate
  Blueprint.
