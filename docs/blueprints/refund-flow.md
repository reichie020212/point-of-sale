# Blueprint: Refund Flow (Full & Partial)

**Status**: Implemented
**Context**: HANDOFF §2 (Mobile), §4 (Sync), §9 (locked decision: partial refunds, reason required)
**Architect**: Gemini
**Executor**: Claude

## 1. Goal

Implement a robust, offline-first refund system that supports itemized
partial refunds, restocks inventory, and requires a reason for every
transaction.

## 2. Why this next?

Refunds are a core "Day 1" POS feature and the last major logic block
for the Sales domain. It exercises the full stack: multi-table
transactional sync, reactive UI updates, and the new regional (PHP)
policy.

## 3. Implementation Strategy

- **Atomic mutations**: a refund is a `refunds` row + N positive
  `inventory_movements` (one per refunded line). The order's
  `status` is recomputed *server-side* from the cumulative refund
  total inside the same transaction — clients never have to derive
  it.
- **Inventory**: each refunded line writes a positive delta with
  `reason='refund'`; `onHand(variantId)` recovers automatically via
  the existing CRDT.
- **UI**: the orders list now navigates to a per-order detail screen,
  which gates the refund flow. The flow itself is a checklist plus a
  required reason.
- **Sync**: `refunds` joins `SUPPORTED` (PUSH writers), `SUPPORTED_PULLS`,
  and `fetchRecord`. The handler emits a *second* EVENT for the parent
  order on every refund PUSH so other devices see the status flip
  without waiting for the next PULL.

## 4. Files touched

### Schema
- `packages/schema/src/sales.ts` — `refunds` gains a `client_op_id`
  column + idempotency index.
- `packages/schema/drizzle/0007_real_loki.sql` — generated migration.

### API
- `apps/api/src/sync/service.ts` — `refunds` joins `SUPPORTED`; new
  writer transactionally inserts the refund, sums prior refunds,
  flips `orders.status` to `partially_refunded` or `refunded`.
- `apps/api/src/sync/handler.ts` — `refunds`, `orders`, `order_items`,
  `inventory_movements`, `shifts` join `SUPPORTED_PULLS`. PUSH ack
  publishes an extra EVENT for the parent order on every refund.
- `apps/api/src/sync/fetch-record.ts` — `refunds` resolves to a real
  row instead of falling back to `{ id }`.

### Mobile
- `apps/mobile/src/db/schema.ts` — schema bumped to v2; `refunds` table
  added.
- `apps/mobile/src/db/migrations.ts` — new file; v1→v2 createTable
  step preserves locally-queued sales.
- `apps/mobile/src/db/models/Refund.ts` — new model + registration.
- `apps/mobile/src/sync/upsert.ts` — `refunds` joins `SUPPORTED` with
  the snake_case column allowlist; server-issued refund rows now
  reactively land in Watermelon.
- `apps/mobile/src/state/refund-helpers.ts` — pure helpers for clamp,
  total, full-vs-partial, and validation.
- `apps/mobile/src/hooks/useOrderDetail.ts` — observes one order +
  items + cumulative refund total reactively.
- `apps/mobile/app/orders.tsx` — rows are now tappable; each links to
  the detail screen.
- `apps/mobile/app/orders/[id].tsx` — order detail with refund gate.
- `apps/mobile/app/refund/[id].tsx` — itemized selection, mandatory
  reason, transactional local write + queue enqueue.

### Tests
- `apps/api/test/sync-push.test.ts` — old "refunds is unsupported"
  case replaced with three new cases: partial refund flips status,
  full refund flips status, bad order_id is rejected.
- `apps/mobile/test/refund-helpers.test.ts` — new file; pins
  `clampQty`, `computeRefundCents`, `isFullRefund`, `validateRefund`.
- `apps/mobile/test/upsert.test.ts` — old "refunds is no-op" case
  replaced with a positive-path upsert case for the `refunds`
  allowlist.

## 5. Verification

- `pnpm lint` — 13/13 green.
- `pnpm build` — 8/8 green.
- `pnpm --filter @counter/api test` — 27 cases, 21 pass + 6 DB-skipped
  (CI runs them against the postgres service).
- `pnpm --filter @counter/mobile test` — 36 cases, all pass (12 new
  refund-helper cases + 1 updated upsert case on top of 23 prior).

## 6. Definition of Done

- [x] Refund flow supports partial item selection and mandatory reasons.
- [x] Order status updates to `refunded` or `partially_refunded`
      reactively (server-side recompute, EVENT fan-out).
- [x] Inventory is correctly restocked via positive
      `inventory_movements` with `reason='refund'`.
- [x] Refund prices use JetBrains Mono via `<Money>` and the active
      org's currency (₱ in PH).
- [x] `pnpm lint`, `pnpm build`, mobile + API tests all green.

## 7. Out of scope (deferred)

- **Loyalty (punchcard) deduction on refund.** Will land with the
  loyalty Blueprint; no schema for punchcards exists yet.
- **Card-payment reversal via Stripe/Square.** This Blueprint only
  records the refund in Counter; the actual gateway reversal is
  deferred to the hardware milestone.
- **Refund permissions (cashier vs manager).** RBAC roles are in the
  schema (`owner|manager|cashier`) but the mobile UI does not yet
  read the active role; today any signed-in user can refund. A
  follow-up Blueprint should gate the refund button on
  `role !== 'cashier'` (or whatever §9 manager-approval policy lands
  as).

## 8. Open §9 ambiguities surfaced

- **Refund time window.** §9 lists "time window" as an open question;
  no time-based gate is enforced today. Recommend follow-up: ask the
  user whether to gate refunds on `created_at < N days`.
- **Reason taxonomy.** §9 says "reason required"; we accept free text.
  If the user wants a fixed dropdown ("Customer changed mind",
  "Quality issue", "Wrong item") to support later analytics, that's
  an additive change.
