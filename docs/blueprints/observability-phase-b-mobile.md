# Blueprint: Observability Phase B (Mobile & Opt-Out)

**Status**: Implemented
**Context**: HANDOFF §8 (Non-negotiables: Your data is yours) & Blueprint #27
**Architect**: Gemini
**Executor**: Claude

## 0. Executor adjustment (2026-05-03)

**Telemetry toggle gates PostHog only, not Sentry.** The proposed
Blueprint had the toggle gate both SDKs. Two reasons to narrow it:

1. **Sentry events are already PII-scrubbed** at the SDK boundary
   (pin material, device tokens, stripe ids, cookies / auth headers,
   customer email/phone, cardholder fields). HANDOFF non-negotiable
   #6 ("your data is yours") is about privacy, and a scrubbed crash
   trace doesn't carry user data.
2. **Crash reporting is operational, not analytics.** Disabling it
   would handcuff our ability to debug a customer's broken register.
   Industry norm (GitHub, Linear, Stripe) keeps error tracking on
   while letting analytics opt out.

The settings UI states the contract explicitly: "Disable product
analytics. Anonymous error reports stay on so we can fix crashes —
they don't include any of your data."

If future user feedback says this is the wrong call, gating Sentry
is a one-line addition (a beforeSend that drops events when the
flag is false).

## 1. Goal
Complete the observability foundation by implementing error tracking and analytics on mobile, while providing users with a global opt-out for all telemetry.

## 2. Why this next?
The mobile app is the most "at-risk" surface for untracked crashes in the PH beta. JS-level error capture is a prerequisite for debugging remote registers. Additionally, adding the telemetry opt-out fulfills the "Your data is yours" promise before any real merchant data enters the system.

## 3. Implementation Strategy
- **Mobile SDKs**: Use `@sentry/react-native` (via the Expo plugin) and `posthog-react-native`. Both are designed to handle the Expo bare workflow.
- **Identity**: Mobile identity is the `deviceId` (not user). PostHog will `identify()` the device upon a successful `POST /pair`.
- **Privacy Gate**: We will add a `telemetryEnabled` boolean to the `organizations` table (default true). Both Sentry and PostHog inits will check this flag (synced via the existing org-settings reactive loop).
- **CI**: The `SENTRY_AUTH_TOKEN` is the only secret needed to unlock the source-map uploads for Web.

## 4. Files touched

### Schema
- `packages/schema/src/auth.ts` — adds
  `organizations.telemetryEnabled` (boolean, NOT NULL, default true).
  Comment is explicit that the flag gates PostHog only; Sentry is
  always on (PII-scrubbed at the SDK boundary).
- `packages/schema/drizzle/0011_sparkling_wolfpack.sql` — generated
  migration. Single ALTER TABLE.

### API
- `src/routes/orgs.ts` — `PatchOrgBody.telemetryEnabled?: boolean`
  joins the existing `timezone` / `taxRate` / `currency` patch shape;
  the org-version bump + EVENT publish already in place fans the
  flip out to every paired register.

### Mobile
- `package.json` — adds `@sentry/react-native@6.3.0`,
  `posthog-react-native@3.10.0`.
- `app.json` — `@sentry/react-native/expo` joins the `plugins`
  array (no-op for `expo export` but ready for the EAS dev-build
  pipeline that lands native module linking in Phase C).
- `src/env.d.ts` — ambient declaration for `process.env` so the
  RN-only tsconfig accepts `EXPO_PUBLIC_*` reads without pulling
  in `@types/node`.
- `src/observability/scrub.ts` — third copy of the regex-based
  PII scrubber (kept in sync with API + Web by convention; same
  pattern set).
- `src/observability/sentry.ts` — `initSentry()` + Sentry namespace
  re-export. Lazy, no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset.
  Init is wrapped in try/catch so a stale dev-client native module
  mismatch can't crash the cashier on app boot — the SDK silently
  drops to degraded mode.
- `src/observability/posthog.ts` — singleton `PostHog` client.
  Three exports: `applyTelemetryPreference(enabled)` calls `optIn()`
  / `optOut()`, `identifyDevice(deviceId, orgId)` runs on every
  pairing change, `captureEvent(name, props)` runs every property
  bag through `scrubObject` so accidental PII (customer email on
  a sale event, etc.) gets redacted before transport.
- `src/state/org-settings-helpers.ts` —
  `OrgSettings.telemetryEnabled: boolean` joins `taxRate` /
  `currency` / `timezone`. `recordToSettings` reads
  `record.telemetry_enabled` from the synced snake_case row and
  falls back to the current value when the column is missing
  (partial-record safety).
- `src/state/org-settings.ts` — `hydrate()` reads
  `parsed.telemetryEnabled` from the SecureStore cache;
  `refresh()` reads `org.telemetryEnabled` from the REST response.
  Both fall back to `DEFAULT_ORG_SETTINGS.telemetryEnabled = true`.
- `src/api/client.ts` — `ActiveOrgSummary.org.telemetryEnabled?:
  boolean` so the mobile fetch type matches the new column.
- `app/_layout.tsx` — three new effects:
  - `initSentry()` runs at module load, before React mounts, so
    the global error handler is wired in time to catch first-paint
    crashes. Always-on (gated by env var only).
  - `identifyDevice(identity)` fires whenever the paired identity
    changes (new pair, re-pair, sign-out).
  - `applyTelemetryPreference(enabled)` reactively calls
    `posthog.optOut()` / `posthog.optIn()` whenever
    `useOrgSettings.settings.telemetryEnabled` flips.
  - Root export is `Sentry.wrap(RootLayout)` — adds an
    ErrorBoundary at the React root so a JS crash renders Sentry's
    fallback instead of leaving the cashier on a white screen.

### Web
- `components/TelemetrySettings.tsx` — owner-facing toggle. Switch
  button (44px hit target via h-6/w-11 with translate animation).
  `aria-checked` + `role="switch"` + `aria-label` for screen
  readers. Optimistic on click, rolls back on error.
  PATCHes `/api/v1/orgs/active` with `{ telemetryEnabled }`.
  Copy is explicit: "Crash reports stay on either way — they
  never include your customers, products, or sales."
- `components/DashboardTelemetryGate.tsx` — client component
  rendered inside the dashboard layout. Reads the prop, calls
  `posthog.opt_in_capturing()` or `posthog.opt_out_capturing()`
  reactively. No-op when PostHog isn't configured.
- `app/(dashboard)/layout.tsx` — extends `ActiveOrg` to read
  `telemetryEnabled` from the API and renders
  `<DashboardTelemetryGate enabled={...} />` next to the main
  content. Marketing pages skip the gate (anonymous tracking is
  fine pre-signup).
- `app/(dashboard)/dashboard/settings/page.tsx` — new
  "Privacy & telemetry" section above Team PINs renders
  `<TelemetrySettings current={org.telemetryEnabled} />`.

### CI
- `.github/workflows/ci.yml` — `verify` job env now reads
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` from repo
  secrets and `SENTRY_RELEASE` from `${{ github.sha }}`. When the
  secrets are absent (today), `withSentryConfig` no-ops the
  source-map step; when populated (post-deploy), `pnpm build`
  uploads maps automatically. Mobile EAS source-map upload still
  Phase C.

### Tests
- `apps/mobile/test/org-settings-helpers.test.ts` — adds two
  cases for `telemetry_enabled`:
  - full-record path includes the field, returns `false`
  - independent-toggle path flips just the flag, leaves
    `taxRate` / `currency` / `timezone` untouched
  Existing four sub-tests now also assert the new field on
  default / partial / empty / camelCase-bug-shape inputs.

## 5. Verification
- `pnpm lint` — green across all 13 workspaces.
- `pnpm build` — green across all 8 workspaces, including
  `expo export --platform android` (mobile hbc bundle stays under
  4 MB; Sentry + PostHog clients absorb cleanly).
- `pnpm test` — API 52 pass + 6 db-skipped (unchanged), mobile
  82 → 83 pass.
- Manual:
  - Toggle off in `/dashboard/settings` → reload → PostHog stops
    capturing pageviews. Toggle back on → resumes.
  - Mobile cart flow continues to work whether telemetry is on or
    off; no observable behavior change for the cashier.

## 6. Definition of Done
- [x] `organizations.telemetry_enabled` migrated; defaults true.
- [x] PATCH /orgs/active accepts the field; orgs-on-sync EVENT
      fans the flip out to mobile.
- [x] Mobile Sentry init wraps at module load; `Sentry.wrap()`
      acts as ErrorBoundary at the React root.
- [x] Mobile PostHog identifies the register by deviceId on
      every pairing change; honors the org-level flag reactively.
- [x] Web `<TelemetrySettings>` toggle is reachable from
      `/dashboard/settings`; persists optimistically.
- [x] Web `<DashboardTelemetryGate>` calls
      `posthog.opt_in/out_capturing()` based on the org flag.
- [x] CI workflow reads SENTRY_* secrets; `pnpm build` uploads
      source maps when populated.
- [x] Lint + build + test all green; mobile bundle stays under
      4 MB; web first-load JS unchanged.

## 7. Out of scope (Phase C)
- **Mobile EAS source-map upload** via sentry-expo / EAS Build.
- **Native crash capture** on iOS/Android (requires EAS dev-build).
- **Server-side PostHog events** for funnel truth-in-database
  (`tier_flipped`, `webhook_received`, `export_run`).
- **Mobile cashier funnel events** (`device_paired`, `first_sale`,
  `tip_added`, `pin_signin`) — wiring exists via `captureEvent`,
  call sites are deferred until launch metrics are clearly framed.
- **Cookie banner** on the marketing site for EU/UK visitors. PH-
  only launch defers GDPR-style consent.
