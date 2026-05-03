# Blueprint: Stripe Billing Phase B.1 — webhook idempotency + ordering

**Status**: Implemented
**Context**: Stripe Phase A (Blueprint #25) §7 deferred items
**Architect**: Claude (executor judgment call — narrow correctness fix)
**Executor**: Claude

## 1. Goal
Close the most load-bearing correctness gap left by Stripe Phase A:
the webhook handler currently re-applies redelivered events and has
no guard against out-of-order delivery. Stripe's docs explicitly
require idempotent webhook handlers; missing this is a beta-launch
risk.

## 2. Why this scope (and not Phase B in full)
Phase B was scoped broadly — DB e2e webhook test, idempotency,
annual prices, success-redirect polling, trial period. Idempotency
+ ordering is the only one that's a real **correctness** fix; the
others are polish or product expansion. Keeping this commit
focused makes review easy and lets the rest of Phase B land
incrementally as needed.

## 3. Architectural choice (flagged)

Two viable shapes:

- **(A) Columns on `billing_subscriptions`.** Add
  `last_event_id text` + `last_event_at timestamp` columns. Webhook
  reads existing row, checks dedupe + ordering before mutating.
  Storage: zero per-event overhead.
- **(B) Dedicated `stripe_events` table.** Track every event id for
  audit history + cross-org dedupe. Storage: one row per event
  forever (or with a TTL prune like `sync_idempotency`).

Going with **(A)**: simpler surface, handles the realistic failure
modes (Stripe redelivery + reorder), and we already keep
event-id-keyed audit logs in pino. If we later need full event
history beyond what Stripe's dashboard shows, (B) becomes a small
follow-up Blueprint.

## 4. Files touched

### Schema
- `packages/schema/src/billing.ts` — adds `lastEventId text` +
  `lastEventAt timestamp with timezone`. Both nullable; null on the
  first-ever event for an org.
- `packages/schema/drizzle/0012_sudden_proudstar.sql` — generated
  migration (two `ADD COLUMN` statements).

### API
- `src/billing/webhook.ts` — new pure helper `shouldApplyEvent(event,
  existing)` returning `'apply' | 'duplicate' | 'out_of_order'`.
  Pure → unit-testable. The route layer keeps owning the DB write.
- `src/routes/billing.ts` — fetches `lastEventId` + `lastEventAt`
  alongside `orgId` in the existing customer-linkage lookup; runs
  `shouldApplyEvent` before mutating; returns
  `{ received: true, applied: false, reason: 'duplicate' | 'out_of_order' }`
  on skip. The successful path also stamps `lastEventId` /
  `lastEventAt` into the upsert so the next event sees them.

### Tests
- `apps/api/test/billing.test.ts` — 6 new cases:
  - first-ever event applies
  - same event id is a duplicate
  - older event is out_of_order
  - newer event applies
  - same-instant event with different id is out_of_order
    (defensive: the FIRST event at that timestamp already brought
    state to consistency, applying a second one risks regression)
  - null `lastEventAt` allows apply (defensive null-safety path)

## 5. Verification
- `pnpm lint` / `pnpm build` / `pnpm test` — all green across all
  workspaces. API tests 52 → 58.
- Manual: a Stripe-dashboard "Resend event" on a subscription event
  now logs `stripe webhook redelivery — skipping duplicate event`
  and the `organizations.tier` row stays consistent.

## 6. Definition of Done
- [x] `last_event_id` + `last_event_at` columns + migration.
- [x] `shouldApplyEvent` pure helper with unit tests.
- [x] Route layer dedupes + orders before mutating.
- [x] Successful application stamps the new event id + timestamp.
- [x] Lint + build + test all green.

## 7. Out of scope (Stripe Phase B continuing)
- DB end-to-end webhook test (boots a server, runs a fixture event
  through the full HTTP path; needs Postgres in test env).
- Annual prices alongside monthly.
- Trial period (e.g. 14-day Pro).
- Success-redirect race polling (the brief window between Stripe's
  redirect to `/dashboard/billing?status=success` and the webhook
  flipping `organizations.tier`).
- Dedicated `stripe_events` table for full audit history.
