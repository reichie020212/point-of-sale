# Blueprint: Observed Watermelon Queries (Mobile UI Reactivity)

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode, "continue")
**Context**: HANDOFF §2 (Offline-first) & §4 (Sync Engine)

## 1. Goal

Move the mobile app from "API-driven" reads to "DB-driven" reactive
reads by wiring WatermelonDB observables into the catalog, orders, and
customers screens. New rows arriving via the broker fan-out → PULL
upsert flow render with no manual refresh, completing the multi-device
acceptance test from `docs/manual-test-plan.md` §4.

## 2. Why this next?

The PUSH and PULL halves of the sync engine landed in the previous two
Blueprints, but the UI still queried the REST API on mount. That meant
"write on phone A → visible on phone B" required navigating away and
back. Subscribing to local Watermelon observables closes that gap and
turns the offline mirror into the canonical read source — which is
the entire point of an offline-first POS.

## 3. Implementation Strategy

- **Reactive subscriptions.** Each hook subscribes to a Watermelon
  query via `observeWithColumns(...)` and re-emits state on any
  change. No `useEffect` fetch loops; no manual refresh.
- **Server UUIDs as the canonical id.** Hooks return the row's
  `serverId` (the server's UUID stored in `_raw.server_id`), not
  Watermelon's local random `_id`. This keeps the cart and PUSH
  payloads referring to a single id space the server understands.
- **Optimistic local writes on checkout.** On cash payment we now
  write the order + items into Watermelon inside one
  `database.write()`, so the orders observer fires immediately. The
  later PULL emit reconciles the row by `server_id` (we set it equal
  to the `clientOpId` so the round-trip lines up).
- **No new dependency.** The implementation uses Watermelon's native
  query observables. No `withObservables` HOC, no extra rxjs imports.

## 4. Execution Steps (Single Commit: `feat(mobile): observed Watermelon queries for sell/orders/customers`)

### Step 1 — `useCatalog` reactive
`apps/mobile/src/hooks/useProducts.ts` — replace the API fetch with two
parallel observables (active products + all variants). Combine in
memory keyed on `product.serverId === variant.product_id`. Loading
flips to `false` once both subscriptions emit.

### Step 2 — `useOrders` new
`apps/mobile/src/hooks/useOrders.ts` — observe the orders collection
sorted `created_at` descending, take 50, and re-emit on
status/synced_at/total_cents changes.

### Step 3 — `useCustomers` new
`apps/mobile/src/hooks/useCustomers.ts` — observe the customers
collection, then sort + filter in memory keyed on a query string so
typing doesn't resubscribe.

### Step 4 — Refactor screens
- `apps/mobile/app/sell.tsx` — drop the API error UI; add an empty
  state when the local catalog is empty.
- `apps/mobile/app/orders.tsx` — render the live order list with
  per-row total and "synced/queued" badge.
- `apps/mobile/app/customers.tsx` — search input + live list with
  loyalty points.

### Step 5 — Optimistic checkout write
`apps/mobile/app/payment.tsx` — on cash success, write the order and
order_items into Watermelon inside one `database.write()` before
enqueuing the server PUSH. `org_id` and `device_id` are written empty
because the mobile app hasn't fetched them yet; the PULL upsert fills
them when the server echoes the row back.

### Step 6 — Verification
- `pnpm --filter @counter/mobile lint`
- `pnpm --filter @counter/mobile typecheck`
- `pnpm --filter @counter/mobile test` — 8 upsert tests still pass.
- `pnpm --filter @counter/mobile build` — Metro produces clean web,
  iOS hbc, and Android hbc bundles.
- `pnpm lint && pnpm typecheck` — repo-wide green.

## 5. Definition of Done

- [x] Sell screen renders products from local Watermelon, with empty
      state when the mirror has no rows yet.
- [x] Orders screen renders the order ledger live; new completed
      orders appear without navigation.
- [x] Customers screen renders a searchable list of synced
      customers with loyalty points.
- [x] Payment cash flow writes a local order + items in one
      `database.write()`.
- [x] All mobile checks (lint, typecheck, test, build) green.
- [x] Repo-wide `pnpm lint` and `pnpm typecheck` green.

## 6. Open questions resolved at execution time

- **`org_id` / `device_id` on the optimistic order row**: written
  empty because the mobile app doesn't have an authenticated org
  context cached locally yet. The PULL upsert fills them when the
  server echoes the order. A future Blueprint that lands the
  `POST /pairing` flow will populate these from the device token
  claim.
- **Initial-empty UX**: the sell screen now shows an "empty catalog"
  hint instead of an indefinite spinner if the local mirror has no
  rows yet (e.g., on a freshly installed app waiting for the first
  PULL).
- **`useCustomers` filter**: filter happens after the observable
  fires, in memory. Typing doesn't tear down the subscription.
