# Blueprint: Sales Integrity & Loyalty Visibility

**Status**: Implemented
**Context**: HANDOFF §9 (RBAC + Loyalty), Blueprints
[refund-flow](./refund-flow.md), [punchcard-loyalty](./punchcard-loyalty.md)
**Architect**: Gemini
**Executor**: Claude

## 1. Goal

Tie up loose ends from the refund and loyalty milestones:

- A refund must invalidate the loyalty punches it was originally
  earned for. Today they linger and let a customer keep credit for a
  returned item.
- The mobile cashier needs to see a customer's punchcard progress —
  today it's a checkout-only surprise.

## 2. Why this next?

Closes the loop on Blueprints #20 and #21. Fixes a small but real
data-integrity hole and turns loyalty from a black box into a visible
part of the customer relationship.

## 3. Implementation Strategy

- **Atomic reversal**: in the API refund writer (already inside a
  transaction with the order-status flip), tombstone any
  `loyalty_punches` whose `order_item_id` belongs to the refunded
  order. Stamp them with the new Lamport version so mobile devices
  pick the deletion up via the standard PULL loop.
- **Reactive UI**: a `PunchProgress` component subscribes to active
  programs + the customer's punches via WatermelonDB observers. A
  refund tombstone arriving on PULL flips the count automatically.
- **Pure helper**: `progressTowardNext(earned, redeemed, threshold)`
  for the "N / threshold" math, unit-tested separately.

## 4. Files touched

### API
- `apps/api/src/sync/service.ts` — refund writer extended:
  `UPDATE loyalty_punches SET deleted_at = now(), version = newVersion
  WHERE org_id = $1 AND order_item_id LIKE $2 || '\_%' ESCAPE '\\'`.
  The escape is defensive: `_` is a SQL LIKE wildcard, so a literal
  underscore must be escaped to avoid matching arbitrary chars at the
  separator position.
- `apps/api/test/sync-push.test.ts` — new case verifying that a
  refund tombstones the order's punches without touching unrelated
  punches.

### Mobile
- `apps/mobile/src/state/loyalty-helpers.ts` — new pure helper
  `progressTowardNext` for the "N / threshold" display math.
- `apps/mobile/src/components/PunchProgress.tsx` — new reactive
  component. Two variants: `row` (compact chips for inline use in a
  list row) and `list` (default, stacked for use inside a card).
- `apps/mobile/src/hooks/useOrderDetail.ts` — exposes `customerId`
  on the OrderDetail return so the order-detail screen can pass it
  into PunchProgress.
- `apps/mobile/app/customers.tsx` — each customer row now shows the
  inline-chip variant.
- `apps/mobile/app/orders/[id].tsx` — order detail now has a Loyalty
  card (visible only when the order has a customer attached).
- `apps/mobile/test/loyalty-helpers.test.ts` — 4 new cases pinning
  `progressTowardNext` (mod-threshold, redemption subtracts a full
  threshold, clamps at zero, zero/negative threshold is a no-op).

## 5. Verification

- `pnpm lint` — 13/13 green.
- `pnpm build` — 8/8 green.
- `pnpm --filter @counter/mobile test` — 60 cases, all pass (4 new
  progressTowardNext cases + the existing 19 loyalty-helpers + 36
  prior).
- `pnpm --filter @counter/api test` — 27 cases, 21 pass + 6
  DB-skipped (CI runs the new refund-tombstones-punches case against
  the postgres service container).

## 6. Definition of Done

- [x] Refund inside a single transaction tombstones every
      `loyalty_punches` row whose `order_item_id` belongs to the
      refunded order.
- [x] Tombstoned rows get the same `version` bump the refund row got,
      so PULL fan-out delivers them to other devices.
- [x] Mobile UI shows per-program "N / threshold" (or "1 free ready"
      when N >= threshold) for any customer with at least one punch.
- [x] Component is reactive — a new sale or a refund tombstone
      arriving on PULL updates the count without a manual refresh.
- [x] Unrelated punches (other orders, other customers) are not
      touched.

## 7. Out of scope (deferred)

- **Real-time fan-out of tombstoned punches**. Today the tombstones
  ride along with the next PULL the device performs (driven by the
  EVENT for the refund row). For instant fan-out, the handler would
  need to query the affected punch ids and emit one EVENT per row —
  invasive across the writer interface and not warranted yet because
  the punch counts only matter at the next sale anyway.
- **RBAC enforcement on refunds.** The §9 locked decision is that
  owner / manager / cashier can all refund, so the policy outcome of
  enforcement is "let everyone in who is signed in". The mobile auth
  model (device token, no active-user concept until PIN sign-in
  lands) doesn't yet have a meaningful "active role" to enforce.
  Revisit when the PIN sign-in milestone exposes an active user — at
  that point we can also start populating `refunds.processed_by_id`.
- **Punch reversal on the *order_items* level.** Today we tombstone
  every punch attached to any of the order's items. If a refund is
  partial (only one item returned), all the punches still get
  tombstoned. The Blueprint accepted this as a reasonable v1: the
  refund flow today refunds by amount, not by item-list, so we don't
  yet know which specific items were returned. When the refund flow
  starts capturing per-item return decisions, this writer can scope
  the tombstone accordingly.
