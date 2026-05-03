# Blueprint: Punchcard Loyalty (Nth Free)

**Status**: Implemented
**Context**: HANDOFF §2 (Mobile), §3 (Web), §4 (Sync), §9 (locked decision: punchcard loyalty)
**Architect**: Gemini
**Executor**: Claude

## 1. Goal

Implement a sync-safe punchcard loyalty system where customers earn
"punches" for qualifying line items and receive the Nth item free,
auto-applied at the register.

## 2. Why this next?

The last major functional domain from the §9 policy update. Integrates
the customers + products domains with the existing sync engine and
gives small shops (cafés, boutiques) a high-value marketing tool.

## 3. Implementation Strategy

- **Ledger-based**, not a counter. Each punch is a row in
  `loyalty_punches` keyed to a `program_id` and (optionally) the
  `order_item_id` that earned or consumed it. This survives multi-
  device offline sales without a CRDT tug-of-war and lets refunds
  tombstone punches in lockstep with the underlying sale.
- **Auto-redeem**, not a manual button. The mobile cart calls
  `useLoyalty` for the active customer; outstanding redemption
  credits are consumed greedily against the cheapest qualifying unit
  in the cart. The discount appears as a "Loyalty (N free)" line in
  the payment summary.
- **Web admin** is the only place to define programs (mobile is sell-
  side only). REST writes bump `organizations.current_version` and
  stamp the row's `version` with the new value, so mobile devices see
  the new program on their next PULL.

## 4. Files touched

### Schema
- `packages/schema/src/loyalty.ts` — new file. `loyalty_programs` and
  `loyalty_punches` with org_id / version / clientOpId / soft-delete.
- `packages/schema/src/customers.ts` — comment updated; the legacy
  `loyalty_points` cashback column stays for backward reporting.
- `packages/schema/src/index.ts` + `drizzle.config.ts` — exports +
  generator config updated.
- `packages/schema/drizzle/0008_smooth_clea.sql` — generated migration
  with both tables, enums, indexes, and FKs.

### Sync protocol
- `packages/sync/src/messages.ts` — `loyalty_programs` +
  `loyalty_punches` join `SYNC_TABLES`.

### API
- `apps/api/src/sync/service.ts` — new writers for both tables;
  programs upsert (LWW) on conflict, punches are append-only (the
  ledger shape).
- `apps/api/src/sync/handler.ts` — both tables join `SUPPORTED_PULLS`
  so a fresh device gets every program + the active customer's punches
  on HELLO.
- `apps/api/src/sync/fetch-record.ts` — both tables resolve to real
  rows for the EVENT broadcast payload.
- `apps/api/src/routes/loyalty.ts` — new file. REST CRUD
  (`/api/v1/loyalty/programs`) for the web admin. Each mutation
  bumps `organizations.current_version` and stamps the row's
  `version` with the new value. Owner / manager only.
- `apps/api/src/server.ts` — register `loyaltyRoutes`.

### Mobile
- `apps/mobile/src/db/schema.ts` — schema bumped to v3; adds both
  loyalty tables.
- `apps/mobile/src/db/migrations.ts` — v2→v3 createTable steps for
  both tables; preserves locally-queued sales.
- `apps/mobile/src/db/models/LoyaltyProgram.ts` +
  `apps/mobile/src/db/models/LoyaltyPunch.ts` — new models +
  registration.
- `apps/mobile/src/sync/upsert.ts` — both tables join `SUPPORTED` with
  the snake_case allowlist; PULL EVENTs reactively land in Watermelon.
- `apps/mobile/src/state/loyalty-helpers.ts` — pure helpers:
  `lineMatchesProgram`, `availableRedemptions`,
  `pickRedemptions` (greedy cheapest-first per program credit),
  `loyaltyDiscountCents`, `earnedPunchesByProgram`.
- `apps/mobile/src/hooks/useLoyalty.ts` — observes active programs +
  the active customer's punches; returns applied redemptions, discount
  cents, and the post-checkout punch enumeration.
- `apps/mobile/app/payment.tsx` — payment summary now shows the
  loyalty discount line; on checkout writes per-line earned punches +
  per-line redemption rows in the same Watermelon transaction as the
  order, and enqueues each for the server.

### Web
- `apps/web/app/(dashboard)/dashboard/loyalty/page.tsx` — new
  dashboard route. Lists programs and renders the admin widget.
- `apps/web/components/LoyaltyAdmin.tsx` — new client component.
  Create form (name + threshold + product/category target) and per-
  row Archive action.
- `apps/web/app/(dashboard)/layout.tsx` — Loyalty nav link added.

### Tests
- `apps/mobile/test/loyalty-helpers.test.ts` — new file. 19 cases
  pinning matching, redemption math, cheapest-first picking,
  per-program earned-punch enumeration, archived-program handling.
- `apps/api/test/sync-push.test.ts` — two new cases: program upsert
  + earned/redemption punch persistence (CI Postgres only); program
  with missing target_id returns invalid_payload.

## 5. Verification

- `pnpm lint` — 13/13 green.
- `pnpm build` — 8/8 green.
- `pnpm --filter @counter/mobile test` — 55 cases, all pass (19 new
  loyalty-helpers cases on top of 36 prior).
- `pnpm --filter @counter/api test` — 27 cases, 21 pass + 6 DB-skipped
  (CI runs the new loyalty integration cases against the postgres
  service container).

## 6. Earned-punch semantic (locked here)

A redemption ("free" unit) earns no punches under any matching program
— the customer didn't pay for it. Two reasonable readings exist:

- *Strict*: free units don't earn anywhere. (Implemented.)
- *Stacking*: a free unit from program A still earns under program B.

We picked strict because it matches mainstream POS behavior and avoids
turning loyalty into a perpetual-motion machine. If the user wants
stacking later, it's a localised change to `earnedPunchesByProgram`
plus the test fixture.

## 7. Out of scope (deferred)

- **Punch reversal on refund.** When a sale gets refunded (refund
  Blueprint), the punches earned by that sale should be tombstoned.
  Today they aren't — the punches stay even if the sale is fully
  refunded. Follow-up: extend the API refund writer to soft-delete
  loyalty_punches with matching `order_item_id`s; the mobile upsert
  already handles tombstones for both tables.
- **Multi-program priority.** When more than one program matches a
  line, redemptions are applied in program-list order. We don't yet
  let the merchant rank programs.
- **Punch expiration.** §9 doesn't define an expiration policy;
  punches live forever unless the program is archived.
- **Customer-facing display.** No "you have N punches" UI on mobile
  yet — the discount only shows up at checkout.

## 8. Open §9 ambiguities surfaced

- **Threshold off by default per product.** The Blueprint phrased it
  this way, but the locked §9 model is per-program (target_type +
  target_id), not per-product opt-in. We took the per-program reading
  because it matches the punchcard mental model. If the user actually
  wants an opt-in flag on products, that's a small additive change.
- **Free-tier gating.** Loyalty is currently available on every paid
  tier (matches the dashboard's tier gate). Whether free-tier orgs
  should see loyalty in some read-only mode is open.
