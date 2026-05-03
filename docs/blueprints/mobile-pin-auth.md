# Blueprint: Mobile PIN Auth & Transaction Attribution

**Status**: Implemented
**Context**: HANDOFF §2 (PIN sign-in), §9 (RBAC), Blueprints
[refund-flow](./refund-flow.md), [punchcard-loyalty](./punchcard-loyalty.md),
[sales-integrity-and-visibility](./sales-integrity-and-visibility.md)
**Architect**: Gemini
**Executor**: Claude

## 1. Goal

Replace the placeholder mobile sign-in with a real 4-digit PIN flow,
sync the user list to the device so PINs verify offline, and stamp
every order's `cashier_id` and every refund's `processed_by_id` with
the active cashier.

## 2. Why this next?

Unblocks the deferred work from the previous milestones:

- RBAC enforcement on refunds becomes meaningful (today the API
  doesn't know which user is sitting in front of the device).
- `processed_by_id` and `cashier_id` audit columns get populated.
- Per-cashier reporting becomes possible.

## 3. Implementation Strategy

- **Offline PINs.** `users` joins the sync loop. Mobile mirrors the
  full row (including `pin_hash`) so PIN check is a local Watermelon
  query. The hash is salted with the user's UUID.
- **Hash byte-compatibility.** A 4-digit PIN has 10 000 possibilities,
  so any cryptographic hash is brute-forceable in milliseconds. We use
  FNV-1a (32-bit, hex output) — small, deterministic, dependency-free,
  and identical on client and server. The hash exists to keep PINs out
  of plaintext storage; the *security* sits in the device-pairing
  layer that gates who can read the synced rows.
- **Ephemeral session.** The active user lives in Zustand only — no
  SecureStore. Sign out + app kill both clear it. Leaving an unlocked
  phone shouldn't grant transaction attribution to whoever picks it up.
- **Set PIN from dashboard.** REST endpoint `PUT /api/v1/users/:id/pin`
  bumps `organizations.current_version` and stamps the user's
  `version` so mobile picks up the new PIN on next PULL.

## 4. Files touched

### Schema
- `packages/schema/src/auth.ts` — `users` gains `pin_hash`,
  `version`, `deleted_at`, and an `(active_org_id, version)` index.
- `packages/schema/drizzle/0009_foamy_black_bird.sql` — generated
  migration.

### Sync
- `packages/sync/src/messages.ts` — `users` joins `SYNC_TABLES`.
- `apps/api/src/sync/handler.ts` — `users` joins `SUPPORTED_PULLS`,
  filtered by `active_org_id`.
- `apps/api/src/sync/fetch-record.ts` — `users` resolves to a real
  row for EVENT broadcast payloads.
- *(intentionally not in `SUPPORTED` writers — mobile reads but
  doesn't push user rows; mutations come from REST.)*

### API
- `apps/api/src/auth/pin-hash.ts` — new file. FNV-1a hash + PIN
  validator. Marked as a byte-twin of the mobile copy.
- `apps/api/src/routes/auth.ts` — three new pieces:
  - `GET /api/v1/users` — list teammates (id, email, name, role,
    `hasPin` boolean) for the dashboard.
  - `PUT /api/v1/users/:id/pin` — set/clear PIN. Owner/manager only;
    transactionally bumps org version.

### Mobile
- `apps/mobile/src/db/schema.ts` — schema bumped to v4 with new
  `users` table; `cashier_id` column added to `orders`.
- `apps/mobile/src/db/migrations.ts` — v3→v4 migration creates
  `users` and adds `cashier_id` to existing `orders` rows. Migration
  list is now ordered descending (v4, v3, v2) per Watermelon's
  expected ordering.
- `apps/mobile/src/db/models/User.ts` — new model + registration.
- `apps/mobile/src/db/models/Order.ts` — `cashierId` field added.
- `apps/mobile/src/sync/upsert.ts` — `users` joins SUPPORTED with
  the snake_case allowlist; `orders` allowlist gains `cashier_id`.
- `apps/mobile/src/state/pin-hash.ts` — new file. Byte-identical
  copy of the API hash.
- `apps/mobile/src/state/auth.ts` — new Zustand store. `signIn(pin)`
  iterates local users with non-null `pin_hash` and verifies; success
  populates `activeUser = { id, name, role }`. `signOut` clears it.
- `apps/mobile/app/index.tsx` — placeholder replaced with a 4-digit
  numeric keypad. Submits when the buffer fills; shake animation +
  clear on failure. Auto-routes to /sell if already signed in.
- `apps/mobile/app/settings.tsx` — new "Signed in" section showing
  cashier name + role + Sign out button (which routes back to /).
- `apps/mobile/app/payment.tsx` — order writes + push payload now
  include `cashier_id` from `useAuth.activeUser`.
- `apps/mobile/app/refund/[id].tsx` — refund writes + push payload
  now include `processed_by_id` from `useAuth.activeUser`.

### Web
- `apps/web/app/(dashboard)/dashboard/settings/page.tsx` — new
  "Team PINs" section.
- `apps/web/components/TeamPinSettings.tsx` — new client component.
  Per-user "Set PIN" / "Change PIN" / "Clear PIN" actions.

### Tests
- `apps/mobile/test/pin-hash.test.ts` — 14 cases. Includes a
  cross-impl regression sentinel (hashing one fixed UUID + PIN to a
  hard-coded hex) so any drift between client and server breaks the
  build.
- `apps/api/test/pin-hash.test.ts` — matching server-side sentinel +
  basic shape/validation cases.

## 5. Verification

- `pnpm lint` — 13/13 green.
- `pnpm build` — 8/8 green.
- `pnpm --filter @counter/mobile test` — 74 cases, all pass (14 new
  pin-hash cases on top of 60 prior).
- `pnpm --filter @counter/api test` — 30 cases, 24 pass + 6
  DB-skipped (3 new pin-hash unit cases).

## 6. Definition of Done

- [x] Cashier signs in with a 4-digit PIN, verified locally against
      the synced `users` row.
- [x] Sign-in works offline (no network round-trip).
- [x] New orders carry `cashier_id`; new refunds carry
      `processed_by_id`.
- [x] Sign Out from Settings clears the active session and routes
      back to the PIN screen.
- [x] Owner / manager can set/clear any teammate's PIN from the
      dashboard.
- [x] PIN hash is byte-identical between API and mobile (sentinel
      tests on both sides).

## 7. Out of scope (deferred)

- **Refund RBAC enforcement.** Now that mobile knows who's signed in,
  the next step is to gate the refund button on `role !== 'cashier'`
  (or whatever §9 manager-approval policy lands as). Today every
  signed-in user can refund. The data is in place — `cashier_id` /
  `processed_by_id` get stamped — but the UI doesn't gate the button
  yet.
- **Biometrics.** Face/Touch ID after first PIN was in the §2 spec.
  Skipped for v1 — PIN works on every device, biometrics needs
  per-platform plumbing.
- **PIN brute-force lockout.** No per-device rate limit on bad PIN
  attempts. The threat model is "trusted physical terminal";
  shoulder-surf is the actual risk, not online brute-force. Add
  `failedAttempts` + a backoff if shops report incidents.
- **Auto sign-out timer.** No idle timeout. A long-running register
  stays signed in to whoever opened the shift. If §9 mandates
  per-shift sign-out, add a timer (or wire it to the `shifts`
  close event when shifts UI lands).
- **Set PIN from mobile.** Today only the dashboard can set PINs.
  A "change my own PIN" flow on the mobile is a future addition.

## 8. Open §9 ambiguities

- **Refund policy on cashier role.** §9 lists owner/manager/cashier
  with refund as an allowed cashier action, but a common shop policy
  is "manager approval required for refunds over $X". Not yet
  implemented; revisit if the user wants the gate.
- **PIN reset / PIN forgot.** Owner/manager can reset any user's
  PIN from the dashboard; a self-serve "forgot PIN" flow is open.
- **Owner-without-PIN bootstrap.** A fresh org has zero PINs set,
  so the mobile sign-in screen would refuse every entry. The
  dashboard bootstrap flow expects the owner to set their own PIN
  first; this is implicit, not enforced.
