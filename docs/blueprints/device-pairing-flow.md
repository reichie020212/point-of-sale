# Blueprint: Device Pairing Flow

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode, "keep going to the next blueprint")
**Context**: HANDOFF §3 (Registers / Sync) & §5 (Backend Endpoints)

## 1. Goal

Replace the dev-token pasting workflow with a real pairing flow:
the web dashboard mints a 5-minute one-shot code, the unpaired
mobile app exchanges it for an opaque device token, and from that
moment on the device sends a token the server can verify and revoke.

## 2. Why this next?

- **Auth**: Until now mobile reads from REST and PUSH'd to sync via a
  raw Clerk session token pasted into Settings. That worked for
  bring-up but isn't shippable.
- **Identity**: The optimistic order writes from the previous Blueprint
  wrote `org_id` and `device_id` empty because there was no way for
  the mobile app to learn either. The pair response returns both, so
  receipts and the `shifts` ledger now stamp the real device id.
- **Revocation**: The web /registers page already had a "Pair new
  device" button that did nothing and no remote-sign-out path. Both
  now work: pairing, plus the existing `POST /devices/:id/revoke`
  invalidates the token immediately on the next request.
- **Closing the W5/6 TODO**: HANDOFF §3 specifies CNTR-XXXX-XXXX
  with a 5-minute TTL, plus device-token auth in the Clerk plugin.
  This Blueprint is the implementation of that.

## 3. Implementation Strategy

- **Token shape.** Opaque, prefixed `dvc_` for cheap dispatch in the
  middleware. The plaintext is shown to the client once; the server
  only stores `sha256(token)` in the existing `devices.token_hash`
  column. No JWT signing key to manage; revocation is `update set
  token_hash = null, status = 'revoked'`.
- **Code shape.** `CNTR-XXXX-XXXX`, 12 chars from a 32-char
  ambiguity-free alphabet (no 0/O/I/1). 5-minute TTL persisted in
  the existing `pairing_code` + `pairing_expires_at` columns on
  `devices`.
- **No new schema.** Both columns already exist (devices was wired
  for this in W5 placeholder). No migration.
- **Public endpoint.** `POST /api/v1/devices/pair` is the one route
  an unpaired client can call without a token. The Clerk plugin's
  `PUBLIC_PREFIXES` gains it.
- **Auth dispatch.** The Clerk preHandler now branches on the `dvc_`
  prefix: it looks up the device by hash and synthesises a
  `request.auth` with `deviceOrgId` set to the internal uuid.
  `getActiveOrg` honours `deviceOrgId` ahead of the user-lookup
  path so a device-token request never needs to find a `users` row.
  The sync WebSocket handler takes the same branch.
- **UX scoping.** No QR rendering or camera scanner this round; the
  web modal shows the 12-char code in big monospace and mobile takes
  the same code through a text field. Hand-typing the 12 chars is
  fast enough for bring-up. QR + scanner is a follow-up open
  question.

## 4. Execution Steps (Single Commit: `feat(api,web,mobile): device pairing flow`)

### Step 1 — Helpers
`apps/api/src/auth/device-token.ts` — code/token generation and
hashing helpers.

### Step 2 — Auth plugin + sync handler
`apps/api/src/auth/clerk.ts` — extend `request.auth` with
`deviceOrgId`, add the device-token branch, add
`/api/v1/devices/pair` to `PUBLIC_PREFIXES`.
`apps/api/src/auth/org.ts` — honour `deviceOrgId` in `getActiveOrg`.
`apps/api/src/sync/handler.ts` — same dispatch on the WebSocket auth.

### Step 3 — Routes
`apps/api/src/routes/devices.ts` — add `POST /code` (Clerk-auth,
pro/business tier) and `POST /pair` (public). Existing list and
revoke routes unchanged in shape but now also clear pairing fields.

### Step 4 — Web
`apps/web/components/PairDeviceButton.tsx` — client modal that
calls `/code`, displays the 12-char code, shows a 5-minute live
countdown, refreshes the registers list on close.
`apps/web/app/(dashboard)/dashboard/registers/page.tsx` — render a
"pairing" pill on rows whose `pairing_code` is still active.

### Step 5 — Mobile
`apps/mobile/app/pair.tsx` — code-entry screen using the same
12-char regex; persists token via `setDeviceToken` and identity
via the new zustand slice + secure-store mirror.
`apps/mobile/src/state/device.ts` — `useDevice` slice with a
hydrate hook so the identity survives app restarts.
`apps/mobile/app/_layout.tsx` — call `hydrate()` once on root mount.
`apps/mobile/app/settings.tsx` — show paired-device card with an
unpair button (deletes token + identity).
`apps/mobile/app/payment.tsx` — stamp optimistic order writes with
the real `org_id` and `device_id` from the device slice.

### Step 6 — Test
`apps/api/test/pairing.test.ts` — full integration sweep:
   - admin requests code → 201;
   - mobile pairs → 200 with `dvc_*` token;
   - device token authenticates `/orgs/active`;
   - reusing a paired code → 404;
   - unknown code → 404;
   - admin revokes → 200;
   - revoked token → 401;
   - free-tier `/code` → 402.

Skips when `DATABASE_URL` is unreachable so contributors without
local Postgres stay green; CI runs against the service container.

## 5. Definition of Done

- [x] `POST /api/v1/devices/code` and `POST /api/v1/devices/pair`
      land with full validation.
- [x] Clerk auth plugin and sync handler accept `dvc_` tokens and
      reject revoked ones.
- [x] Web "Pair new device" button opens a modal, displays the
      code with a live countdown, and refreshes the list on close.
- [x] Mobile pair screen accepts the code, stores token + identity,
      navigates to /sell. Settings shows paired identity and an
      unpair button.
- [x] Optimistic order writes now stamp `org_id` + `device_id` from
      the paired identity instead of empty strings.
- [x] Pairing integration test covers happy path + 5 error cases.
- [x] `pnpm lint`, `pnpm typecheck`, mobile build (`expo export`),
      and web build all green.

## 6. Open questions resolved at execution time

- **QR codes / camera scanning**: deferred. Requires a camera
  permission scaffold and either `expo-camera` or
  `expo-barcode-scanner`. The current 12-char hand-typed code works
  for bring-up; the next round can add a scan path on top.
- **`pending` status enum**: the `device_status` enum is
  `live/offline/revoked`; we did not add a `pending` value because
  `pairing_code != null` is already the active flag. The `/devices`
  list endpoint surfaces `pairingActive` so the dashboard can render
  it explicitly.
- **Identity persistence**: stored in `expo-secure-store` under
  `counter.deviceIdentity`, mirrored into the zustand slice via the
  new `hydrate()` hook on root mount. Survives app restarts so
  Settings and checkout don't need to re-query the server.
- **Test-bearer interaction**: `TEST_BEARER` is checked before the
  device-token branch so existing integration tests keep working.

## 7. What this unblocks

- Real `device_id` on the `shifts` ledger (HANDOFF §2 acceptance).
- Remote sign-out from the web /registers page (existing revoke
  endpoint already wired; now enforced).
- Audit trails on orders that survive operator handoff.
- Scope reduction on every future "auth as device" Blueprint —
  middleware no longer needs new branches.
