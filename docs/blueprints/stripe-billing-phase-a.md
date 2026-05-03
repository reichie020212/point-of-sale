# Blueprint: Stripe Billing & Tier Gating (Phase A)

**Status**: Implemented
**Context**: HANDOFF §3 (Pricing), §7 (W7) & Blueprint #25
**Architect**: Gemini
**Executor**: Claude

## 0. Executor adjustments (2026-05-03)

Two simplifications from the proposed Blueprint, made before/during execution:

- **`checkout.session.completed` not handled.** Stripe always emits a
  follow-up `customer.subscription.created` (which carries the same
  customer + price + metadata), so the checkout-session event becomes
  redundant. The mapper handles only the four subscription/invoice
  events. If the subscription event is ever delayed beyond Stripe's
  normal envelope we'd see lost linkages — Phase B can re-introduce
  the event for redundancy if that turns out to bite.
- **Tier gating already lived at `apps/api/src/auth/tier.ts`.** No
  middleware refactor was needed; `requireTier(['pro', 'business'])`
  is already wired on `/devices`, `/imports`, `/reports`, `/sync`.
  Phase A focuses on making sure the *source-of-truth flip* on
  `organizations.tier` happens correctly via the webhook.

## 1. Goal
Implement the core Stripe Billing lifecycle (Checkout, Webhooks, Tier Transitions) to enable paid Pro/Business plans and enforce service gating.

## 2. Why this next?
This is the most significant unblocked architectural chunk. It transforms the project from a "free tool" into a "SaaS product." By landing the webhook and state machine first, we establish the source of truth for `organizations.tier`, which then drives all other feature gates (sync, reports, multi-device).

## 3. Implementation Strategy
- **Hosted UX**: Use Stripe Checkout (for upgrades) and Stripe Customer Portal (for management). No custom payment forms.
- **Webhook Security**: Use `fastify-raw-body` to ensure the Stripe signature can be verified against the unmodified payload.
- **State Machine**: The `organizations.tier` is the primary flag. The `billing_subscriptions` table holds the audit trail and Stripe IDs.
- **Gating**: Sync and Reports are the hard paywalls. The mobile app continues to work locally but its `WSS /sync` connection will be rejected with `code: 'tier_required'` for free orgs.

## 4. Files touched

### Schema
- `packages/schema/src/billing.ts` — new. `billing_subscriptions`
  table: one row per org (unique `org_id`), holds Stripe customer +
  subscription ids, status, paid tier, current period end, and
  cancel-at-period-end flag. Intentionally NOT in `SYNC_TABLES` —
  stripe ids never leak to mobile registers.
- `packages/schema/src/index.ts` + `drizzle.config.ts` — barrel +
  drizzle-kit registration.
- `packages/schema/drizzle/0010_milky_molly_hayes.sql` — generated
  migration. Cascade on org delete; unique on org_id, customer id,
  and subscription id.

### API
- `apps/api/src/billing/stripe.ts` — lazy `getStripe(secretKey)`
  returning null when `STRIPE_SECRET_KEY` is unset (so CI / fresh
  dev clones still boot). Pinned API version `2024-10-28.acacia`.
  `priceIdToTier(priceId, cfg)` resolves Stripe Price IDs back to
  `'pro'` | `'business'` | null.
- `apps/api/src/billing/webhook.ts` — pure event-to-side-effects
  mapper. `mapWebhookEvent(event, cfg) → WebhookOutcome` discriminated
  union: `subscription` (upsert + tier flip), `audit` (log only),
  `ignored`. `tierForStatus()` keeps paid tier through
  `active`/`trialing`/`past_due`; downgrades on
  `canceled`/`unpaid`/etc. Pure, no Fastify/SDK transport.
- `apps/api/src/billing/checkout.ts` — `createCheckoutSession()` +
  `createPortalSession()` thin wrappers. Stamps `metadata.orgId` on
  both the session and the subscription so webhooks always know
  which Counter org they belong to.
- `apps/api/src/routes/billing.ts` — three routes:
  - `POST /api/v1/billing/checkout` (Clerk + owner): resolves price
    id from config, looks up existing customer, creates session,
    returns `{ url, sessionId }`.
  - `POST /api/v1/billing/portal` (Clerk + owner): creates portal
    session for the org's existing Stripe customer.
  - `POST /api/v1/billing/webhook` (signature-gated, no Clerk):
    verifies HMAC against `STRIPE_WEBHOOK_SECRET` using `request.rawBody`,
    runs `mapWebhookEvent`, transactionally upserts
    `billing_subscriptions` + flips `organizations.tier`.
- `apps/api/src/server.ts` — registers `fastify-raw-body` plugin
  with `global: false`, `runFirst: true`, scoped via the route's
  `config: { rawBody: true }`. Registers `billingRoutes({ config })`.
- `apps/api/src/auth/clerk.ts` — `/api/v1/billing/webhook` joins
  `PUBLIC_PREFIXES` (no bearer required; signature is the auth).
- `apps/api/src/config.ts` — six new env vars, all optional in
  dev/test:
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`
  - `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL` (default to localhost)

### Web
- `apps/web/app/(marketing)/pricing/page.tsx` — Free/Pro/Business
  cards with PHP placeholder prices (`₱0` / `₱1,499 / mo` /
  `₱3,999 / mo`). Each paid tier renders a server-action form that
  calls `POST /api/v1/billing/checkout`, then redirects the browser
  to the returned Stripe Checkout URL. Unauthenticated visitors
  bounce to `/sign-in?redirect_url=/pricing`. Status banners for
  `canceled` / `billing_not_configured`.
- `apps/web/app/(dashboard)/dashboard/billing/page.tsx` — new.
  Renders current tier + "Manage billing" form-action that calls
  `POST /api/v1/billing/portal` and redirects to the Stripe
  Customer Portal. Status banners for `success` /
  `no_subscription` / `role_required` / `billing_not_configured`.
- `apps/web/app/(dashboard)/layout.tsx` — adds "Billing" link to
  the dashboard nav.

### Tests
- `apps/api/test/billing.test.ts` — 11 unit tests on the pure mapper
  + price-to-tier resolver. Covers paid-tier flip, downgrade on
  cancellation, dunning grace (past_due stays paid), cancel-at-period-
  end keeps tier until expiry, unknown price → ignored, payment
  failure → audit, unknown event → ignored, timestamp conversion.

## 5. Verification
- `pnpm lint` — green across all 13 workspaces.
- `pnpm build` — green across all 8 workspaces. Web emits new
  `/dashboard/billing` route.
- `pnpm test` — API tests 30 → 41 (11 new), all pass; mobile 82
  unchanged. DB integration tests still skip when DATABASE_URL is
  unreachable.

## 6. Definition of Done
- [x] `billing_subscriptions` migration generated (drizzle 0010).
- [x] Webhook signature verification using rawBody + Stripe SDK.
- [x] Subscription lifecycle events flip `organizations.tier`.
- [x] Owner-only checkout + portal endpoints; managers/cashiers 403.
- [x] Free → free for unknown price ids; cancellation downgrades.
- [x] Marketing /pricing CTAs route through Stripe Checkout.
- [x] /dashboard/billing exposes "Manage billing" button.
- [x] Lint + build + test all green.

## 7. Out of scope (Phase B / C)
- **DB integration test** for the webhook end-to-end (verify
  `organizations.tier` row state after replay). Requires Postgres in
  the test env; the pure-mapper tests cover the state machine, the
  CI matrix can grow this.
- **`checkout.session.completed` redundancy.** Subscription events
  carry everything we need; if Stripe ever delays subscription
  events beyond their normal envelope we'd want this back.
- **Webhook idempotency on Stripe event id.** Stripe occasionally
  redelivers; we currently re-apply the same tier transition (which
  is idempotent) but log it twice. A `stripe_events` table keyed on
  event id would silence that.
- **Status banners on the success-redirect race.** If the webhook
  hasn't processed by the time Stripe redirects the user back,
  `/dashboard/billing` may briefly show the old tier. The `?status=
  success` banner says "it can take a moment to propagate" — fine
  for v1; a polling state would be the polish.
- **Annual prices.** Phase A is monthly only (PHP).
- **Trial period.** Not configured.
- **Grace period after `payment_failed`.** Stripe's default 3-retry
  dunning applies; we mirror status changes but don't add custom
  delays.

## 8. Open question for Red
- **PHP price points** (₱1,499 / ₱3,999) are placeholders. Set the
  matching Stripe Product prices and update the marketing copy when
  the real numbers land.
