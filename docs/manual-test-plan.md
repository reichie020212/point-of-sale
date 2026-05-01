# Manual Test Plan — Counter POS

The W2–W8 master push leans on automated CI for unit, lint, typecheck, build,
and API integration coverage. This document covers the parts that need real
hardware, real network conditions, or real human judgment.

The W3 acceptance test from HANDOFF §4 — **offline mobile sale → reconnect →
web-visible** — lives at the bottom; it is the gate before declaring the
push shippable.

---

## 1. Setup

### 1.1 Backend

- Postgres 16 reachable at `DATABASE_URL`.
- `pnpm install`
- `pnpm --filter @counter/schema db:migrate`
- `pnpm --filter @counter/api dev` (port 4000)

### 1.2 Web dashboard

- `pnpm --filter @counter/web dev` (port 3000)
- Sign up, complete onboarding, create an org with region `US`.
- In Postgres, bump the org tier so the dashboard isn't redirected to /pricing:
  `update organizations set tier = 'pro' where slug = '<your-slug>';`

### 1.3 Mobile app

- Connect a physical Android device or open an emulator.
- `pnpm --filter @counter/mobile start` and run on device.
- Sign in with the same Clerk account used on the web.

---

## 2. Web dashboard

| #   | Step                                                       | Expected                                                                                               |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2.1 | Visit `/dashboard`                                         | Four KPI cards (gross / orders / avg ticket / net) plus sales chart and top items load without errors. |
| 2.2 | Switch range to `7d`, `30d`, `90d`                         | Chart re-renders; bucket changes from hour → day.                                                      |
| 2.3 | Visit `/dashboard/products`                                | Table loads.                                                                                           |
| 2.4 | Click **Import CSV**, upload a Square-style export         | Returns `+N inserted` summary; table refreshes with new rows.                                          |
| 2.5 | Click **Export CSV**                                       | Browser downloads `products-<uuid>.csv`. Open it: header row matches Square / Shopify conventions.     |
| 2.6 | Visit `/dashboard/customers`                               | Table loads. Search box filters by name / email / phone.                                               |
| 2.7 | **Export CSV** on customers                                | Downloads `customers-<uuid>.csv`.                                                                      |
| 2.8 | Visit `/dashboard/registers`                               | Empty state if no devices paired; shows pill + last-seen for paired ones.                              |
| 2.9 | Drop tier back to `free` in Postgres, refresh `/dashboard` | Redirects to `/pricing`.                                                                               |

---

## 3. Mobile app

| #   | Step                           | Expected                                                                                                                            |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Open the app cold, no internet | Tabs load. SyncBanner shows "Working offline."                                                                                      |
| 3.2 | Sell two items in the catalog  | Cart updates, total recomputes in JetBrains Mono.                                                                                   |
| 3.3 | Tap **Charge → Cash**          | Receipt screen renders; sale lands in local DB.                                                                                     |
| 3.4 | Reconnect to the internet      | Sync banner clears (status: live).                                                                                                  |
| 3.5 | Org tier == free in Postgres   | Banner shows "Sync paused — upgrade to Pro" once the sync client opens; sells continue to work locally (HANDOFF non-negotiable #1). |
| 3.6 | Bump tier to `pro`, reopen app | Banner clears; queued offline sales push and become visible on the web dashboard.                                                   |

---

## 4. Sync acceptance test (HANDOFF §4 W3 gate)

Run this end-to-end in a single session. Failure at any step blocks the W2–W8
push from being declared shippable.

1. Start with the mobile app online and tier == pro. Ring up a sale and
   confirm it appears within 5 s on `/dashboard/products` top items and on
   `/dashboard` KPI gross.
2. Put the phone in airplane mode.
3. Ring up three more sales offline. SyncBanner shows offline.
4. Verify each sale appears on the receipt screen. The local DB count
   advances; web shows nothing new.
5. Disable airplane mode. SyncBanner returns to live within ~5 s.
6. Within ~10 s, confirm all three offline sales appear on the dashboard
   in the correct order (`created_at` is monotonic, no duplicates from
   the idempotency-key retry).
7. Issue a refund from the mobile receipt screen. Verify net on the
   dashboard drops by the refund amount; gross is unchanged.
8. Force-close the app, relaunch — no resync of already-acked sales.

---

## 5. CSV templates

Confirmed compatible with:

- **Square Online** product export — column order: `name,description,sku,price,...`
- **Shopify** product export — `Title,Body (HTML),Variant SKU,Variant Price,...`

The importer is permissive: extra columns are ignored, missing optional
columns default. The importer fails the row (not the batch) if `name` or
`price` is missing or non-numeric.

---

## 6. Known gaps (out of scope for this push)

- No automated end-to-end test in CI for the airplane-mode flow — needs
  a device farm; manual only for now. The durable sync queue (HANDOFF
  §2.3) is testable manually via §3.1–3.6 and §4 above; the Watermelon
  table now persists across app kills.
- Pairing flow (`POST /pairing`) ships in W5+. Devices listed via
  `/api/v1/devices` today are seeded by direct DB insert.
- Receipt printing on real Bluetooth printers is interface-only; the
  printer driver lands in M9 follow-up.
- Real Clerk-token JWKS verification is bypassed in the CI integration
  test via `TEST_BEARER`. End-to-end with real Clerk is exercised
  manually via the steps above.
- Cross-instance sync fan-out: the broker contract is tested via
  `apps/api/test/pubsub.test.ts`. The WebSocket → EventMessage path is
  wired but not yet asserted in CI; covered by manual verification
  when running two API instances against a single Redis.
