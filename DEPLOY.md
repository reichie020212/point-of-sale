# DEPLOY.md — Counter POS

Local development setup and production deployment guide.

> **Note on Docker Compose.** Counter's production targets (Fly.io / managed Postgres / managed Redis / EAS Build for mobile) don't compose cleanly into a single `docker-compose.yml`, and the mobile app cannot be containerized at all. This guide uses native installs for local dev and platform deployments for production. If you specifically need a containerized local stack later, it can be added as `docker-compose.local.yml` covering only `api + postgres + redis + minio`.

---

## Status

The monorepo is fully scaffolded: `apps/{api,web,mobile}` and
`packages/{schema,sync,tokens,ui-mobile,printers,payments,...}` all
exist and pass lint + typecheck + tests in CI. The W2–W8 master push
landed (auth, products, sync, cart, payment, receipts, dashboard,
reports, customers, loyalty, registers, import/export, billing
Phase A, observability A+B); the refund flow lands the breakdown +
per-line tracking + history + receipts arc on top of that.

The "Production deployment" section below describes the target
topology (Fly + Vercel + Neon + Upstash + R2 + EAS). The
[Pre-flight checklist](#4--pre-flight-checklist-before-first-production-deploy)
in §4 lists the ops items that still need to be provisioned for first
launch — none of those are code work.

---

## 1 · Local development

### 1.1 Prerequisites

| Tool           | Version    | Install                                                                               |
| -------------- | ---------- | ------------------------------------------------------------------------------------- |
| Node.js        | **20 LTS** | [nodejs.org](https://nodejs.org/) or `nvm install 20`                                 |
| pnpm           | **9.x**    | `npm i -g pnpm@9` or `corepack enable && corepack prepare pnpm@latest --activate`     |
| PostgreSQL     | **16.x**   | `brew install postgresql@16` (macOS) / `apt install postgresql-16` (Debian)           |
| Redis          | **7.x**    | `brew install redis` / `apt install redis-server`                                     |
| Watchman       | latest     | `brew install watchman` (required by React Native on macOS)                           |
| Java JDK       | **17**     | `brew install --cask zulu@17` (Android builds)                                        |
| Xcode          | **15+**    | App Store (iOS builds; macOS only)                                                    |
| Android Studio | latest     | [developer.android.com/studio](https://developer.android.com/studio) (Android builds) |
| EAS CLI        | latest     | `npm i -g eas-cli` (Expo Application Services for mobile builds)                      |

Verify the basics:

```bash
node --version    # v20.x
pnpm --version    # 9.x
psql --version    # 16.x
redis-cli ping    # PONG
```

### 1.2 First-time setup

```bash
git clone https://github.com/reichie020212/point-of-sale counter
cd counter
pnpm install                      # installs all workspace packages

# Local services
brew services start postgresql@16 # macOS — adjust for your OS
brew services start redis

# DB bootstrap
createdb counter_dev
DATABASE_URL=postgresql://localhost:5432/counter_dev \
  pnpm --filter @counter/schema db:migrate

# Environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Mobile reads its API URL from app.json's `extra.apiUrl`; defaults to
# http://localhost:4000 when unset, which is right for an emulator
# pointing at the dev API. No mobile .env needed for local dev.
```

Fill in `apps/api/.env` and `apps/web/.env` with at minimum:

| Var                                          | Where | Source                                            |
| -------------------------------------------- | ----- | ------------------------------------------------- |
| `DATABASE_URL`                               | api   | Local: `postgresql://localhost:5432/counter_dev`  |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | both  | Clerk dashboard → API Keys (use a `dev` instance) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`          | web   | Same as above; bundled into client JS             |
| `NEXT_PUBLIC_API_URL`                        | web   | `http://localhost:4000`                           |
| `CORS_ORIGINS`                               | api   | `http://localhost:3000`                           |

Stripe and S3/MinIO env vars are optional in dev — the API tolerates
missing Stripe keys (billing endpoints return 503) and the dev loop
doesn't need uploads to function. See §1.4 for MinIO if you want to
exercise file uploads, and §2.10 for the Stripe test-mode setup.

### 1.3 Run the dev loop

`pnpm dev` from the repo root runs `turbo run dev --parallel` and
brings up every workspace's `dev` script in one terminal. Most
contributors run the API + web together and start mobile in a
separate terminal so the Expo prompts don't fight with API logs.

```bash
# Terminal 1 — api on :4000, web on :3000
pnpm --filter @counter/api dev
pnpm --filter @counter/web dev    # in another terminal, or use `pnpm dev` to do both

# Terminal 2 — Expo dev server
pnpm --filter @counter/mobile start
# Press `i` (iOS Simulator), `a` (Android emulator), or scan the QR
# code with Expo Go on a physical device.
```

If you really want everything at once:

```bash
pnpm dev   # api + web + mobile (Expo) in parallel under turbo
```

Default ports:

| Service       | Port | Notes                              |
| ------------- | ---- | ---------------------------------- |
| API (Fastify) | 4000 | REST + `/sync` WebSocket           |
| Web (Next.js) | 3000 | Marketing + dashboard route groups |
| Postgres      | 5432 | DB name `counter_dev`              |
| Redis         | 6379 | pub/sub + rate limiting            |
| Expo Metro    | 8081 | Mobile bundler                     |

### 1.4 Object storage for local dev

For local file uploads (receipt images, exports), run **MinIO** as an S3-compatible store:

```bash
brew install minio/stable/minio
mkdir -p ~/minio-data
minio server ~/minio-data --console-address ":9001"
# Console: http://localhost:9001  (minioadmin / minioadmin)
# S3 endpoint: http://localhost:9000
```

Set in `apps/api/.env`:

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=counter-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
```

### 1.5 Common dev tasks

```bash
pnpm lint                                  # ESLint across all workspaces
pnpm lint:fix                              # auto-fix lint where possible
pnpm format                                # Prettier write
pnpm typecheck                             # tsc --noEmit, every workspace
pnpm test                                  # node:test + tsx, per workspace

# Schema migrations (Drizzle)
pnpm --filter @counter/schema db:generate  # diff src/*.ts → new migration SQL
pnpm --filter @counter/schema db:migrate   # apply pending migrations
pnpm --filter @counter/schema db:studio    # open Drizzle Studio

# Reset the local DB (drops + recreates `counter_dev`)
dropdb counter_dev && createdb counter_dev
DATABASE_URL=postgresql://localhost:5432/counter_dev \
  pnpm --filter @counter/schema db:migrate
```

The DB-backed integration tests (`apps/api/test/integration.test.ts`,
`apps/api/test/sync-push.test.ts`) auto-skip when `DATABASE_URL` isn't
reachable. To run them locally, set `DATABASE_URL=postgresql://…/counter_test`
on a database with the migrations applied — CI brings up a fresh
Postgres service container and runs them on every push.

### 1.6 Mobile development specifics

```bash
pnpm --filter @counter/mobile start       # Metro on :8081, Expo Dev Tools
pnpm --filter @counter/mobile ios         # build + launch iOS sim (macOS only)
pnpm --filter @counter/mobile android     # build + launch Android emulator
```

**Pointing mobile at the API.** The mobile app reads
`Constants.expoConfig.extra.apiUrl` and falls back to
`http://localhost:4000`. The default is right for an iOS simulator on
the same machine as the API. For an Android emulator, the loopback
address is `10.0.2.2`; for a physical device, use your machine's LAN
IP (or an `ngrok` tunnel) and set `extra.apiUrl` in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://192.168.1.42:4000"
    }
  }
}
```

**Expo Go vs custom dev client.** Most of the screens (catalog, cart,
checkout, refund flow, orders) work in **Expo Go**. Native modules
(BLE thermal printer in `packages/printers/src/ble.ts`, the planned
Stripe Terminal SDK in `packages/payments/src/stripe.ts`) are
scaffolded but not wired up — they'll need a custom dev client
(`eas build --profile development`) once hardware ships.

**Data isolation.** Each Expo Go install gets its own WatermelonDB
file in the app sandbox. To start fresh, uninstall + reinstall, or
shake the device and tap "Clear async storage" in the dev menu.

### 1.7 Tester workflow

The [`docs/manual-test-plan.md`](./docs/manual-test-plan.md) document
is the canonical script for human-driven QA — it walks the W3
acceptance gate (offline mobile sale → reconnect → web-visible) plus
hardware-dependent flows.

A few utilities testers reach for that don't live in the test plan:

```bash
# Bump an org from free → pro so the dashboard isn't redirected to /pricing
psql counter_dev -c "update organizations set tier = 'pro' where slug = '<your-slug>';"

# Inspect the most recent refunds (handy when verifying the breakdown columns)
psql counter_dev -c "select id, amount_cents, subtotal_cents, tax_cents, tip_cents, line_qtys_json, reason
                     from refunds order by created_at desc limit 5;"

# Tail API logs while reproducing a flow
pnpm --filter @counter/api dev | tee /tmp/counter-api.log
```

Surfaces and how to verify them:

| Surface        | URL / launch                               | Ports |
| -------------- | ------------------------------------------ | ----- |
| Web dashboard  | `http://localhost:3000/dashboard`          | 3000  |
| Marketing site | `http://localhost:3000`                    | 3000  |
| API health     | `http://localhost:4000/healthz`            | 4000  |
| API readiness  | `http://localhost:4000/readyz` (DB+broker) | 4000  |
| Sync WebSocket | `ws://localhost:4000/sync`                 | 4000  |
| Mobile         | Expo Go QR / iOS sim / Android emulator    | 8081  |

---

## 2 · Production deployment

Production uses platform services rather than a single self-hosted stack. Each surface deploys independently.

### 2.1 Topology

```
Users (mobile + web)
       │
       ├── counter.app             → Vercel (Next.js, marketing route group)
       ├── app.counter.app         → Vercel (Next.js, dashboard route group)
       └── api.counter.app         → Fly.io (Fastify, multi-region)
               │
               ├── Postgres        → Neon (region-pinned per org: US, EU)
               ├── Redis           → Upstash (pub/sub + rate limiting)
               ├── Object store    → Cloudflare R2 (S3-compatible)
               └── CDN / DNS       → Cloudflare
Mobile binaries
       └── EAS Build → APK (CDN-hosted) + iOS TestFlight
```

### 2.2 Backend — Fly.io (`apps/api`)

```bash
# One-time
flyctl auth login
cd apps/api
flyctl launch                     # creates fly.toml; choose region(s) close to users
flyctl secrets set \
  DATABASE_URL=...                \
  REDIS_URL=...                   \
  JWT_SECRET=...                  \
  STRIPE_SECRET_KEY=...           \
  STRIPE_WEBHOOK_SECRET=...       \
  STRIPE_PRICE_PRO=price_...      \
  STRIPE_PRICE_BUSINESS=price_... \
  BILLING_SUCCESS_URL=https://app.counter.app/dashboard/billing?status=success \
  BILLING_CANCEL_URL=https://counter.app/pricing?status=canceled \
  S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
  S3_ACCESS_KEY=...               \
  S3_SECRET_KEY=...               \
  S3_BUCKET=counter-prod
flyctl deploy
```

For multi-region (US + EU per HANDOFF §5), run two Fly apps (`counter-api-us`, `counter-api-eu`) each pointing at the regional Neon project. Org region pinning is enforced at signup; the region prefix is encoded in the device token so the WebSocket lands on the right region.

**Health checks** in `fly.toml`:

```toml
[checks.http]
  port = 4000
  type = "http"
  interval = "15s"
  timeout = "2s"
  path = "/healthz"
```

WebSocket support is built in to Fly; no extra config needed beyond declaring the port.

### 2.3 Database — Neon

1. Create a Neon project per region (US, EU).
2. Use the **pooled** connection string for app traffic, **direct** for migrations.
3. Set Postgres version to **16**.
4. Enable point-in-time restore (PITR); HANDOFF tier 2 promises 90-day backups.
5. Migration command in CI: `pnpm --filter api db:migrate:deploy` against the direct URL.

### 2.4 Cache + pub/sub — Upstash Redis

1. Create a regional Upstash Redis database matched to each Fly region.
2. Use the **TLS** REST or `rediss://` connection string.
3. Used for: WebSocket pub/sub fan-out across Fly machines, rate limiting on auth/sync endpoints.

### 2.5 Object store — Cloudflare R2

1. Create a bucket: `counter-prod` (US), `counter-prod-eu` (EU).
2. Generate an R2 access key with read/write scoped to the bucket.
3. Set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_FORCE_PATH_STYLE=true`.
4. Used for receipt images, product photos, export job artifacts.

### 2.6 Web — Vercel (`apps/web`)

Same Next.js app serves both `counter.app` (marketing route group) and `app.counter.app` (dashboard route group).

```bash
# One-time, from apps/web:
vercel link
vercel env add NEXT_PUBLIC_API_URL production           # https://api.counter.app
vercel env add NEXT_PUBLIC_SYNC_URL production          # wss://api.counter.app/sync
vercel env add CLERK_PUBLISHABLE_KEY production         # or AUTH_SECRET if Auth.js
vercel env add CLERK_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel deploy --prod
```

In Vercel project settings, attach domains:

- `counter.app` → production
- `app.counter.app` → production
- `*.counter.app` (or specific subdomains) → preview as needed

### 2.7 DNS — Cloudflare

| Record                     | Target                                      |
| -------------------------- | ------------------------------------------- |
| `counter.app` (A/CNAME)    | Vercel                                      |
| `app.counter.app` (CNAME)  | Vercel                                      |
| `api.counter.app` (CNAME)  | Fly.io app                                  |
| `sync.counter.app` (CNAME) | Fly.io app (alias of `api`, optional split) |

Enable proxying for `counter.app` and `app.counter.app`. **Disable proxying** (DNS-only) for `api.counter.app` if you want WebSockets to bypass Cloudflare's WS quirks; otherwise enable WebSocket support in the Cloudflare zone settings.

### 2.8 Mobile — EAS Build

```bash
cd apps/mobile
eas login
eas build:configure               # generates eas.json
```

`eas.json` profiles to define:

- `development` — internal dev client with native modules.
- `preview` — internal distribution APK + ad-hoc iOS for QA.
- `production` — Play Store AAB + App Store / TestFlight build.

Build commands:

```bash
eas build --platform android --profile production       # AAB → Play Store
eas build --platform android --profile preview          # APK → upload to CDN
eas build --platform ios --profile production           # TestFlight + App Store
```

**APK distribution** (HANDOFF §3): the marketing site links to `/api/download/apk?channel=stable`, which the API redirects to a versioned R2 object. The CI step on a `production` Android build uploads the resulting APK to R2 and updates the `stable` pointer.

### 2.9 Observability

| Concern           | Tool                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| Error tracking    | Sentry (api + web + mobile, JS-level on mobile until EAS build pipeline)           |
| Product analytics | PostHog (web + mobile, opt-out toggle in /dashboard/settings)                      |
| Logs              | Fly logs → Logtail / Axiom (long-term retention)                                   |
| Uptime            | Better Uptime / Cronitor probing `/healthz` (liveness) and `/readyz` (DB + broker) |

#### Sentry env vars (per surface)

All optional in dev/test — without a DSN the SDK is a no-op so `pnpm
dev` and CI run untouched. Production sets one DSN per surface so
events route to separate Sentry projects.

| Var                             | Surface       | Purpose                              |
| ------------------------------- | ------------- | ------------------------------------ |
| `SENTRY_DSN`                    | API + Web SSR | Server runtime DSN                   |
| `NEXT_PUBLIC_SENTRY_DSN`        | Web client    | Browser DSN (bundled into client JS) |
| `SENTRY_RELEASE`                | All           | Git sha; CI sets from `$GITHUB_SHA`  |
| `SENTRY_ENVIRONMENT`            | All           | `production` / `staging` / `preview` |
| `SENTRY_TRACES_SAMPLE_RATE`     | API           | 0..1; defaults 1.0 for the beta      |
| `SENTRY_AUTH_TOKEN`             | Build-time    | Web source-map upload                |
| `SENTRY_ORG` + `SENTRY_PROJECT` | Build-time    | Web source-map upload routing        |

PII scrubbing is hard-wired at SDK init: `pin_hash`, `device_token`,
`stripe_customer_id`, `authorization` / `cookie` headers, customer
`email` / `phone`, and cardholder fields (`pan`, `cvv`, etc.) are
redacted from every event before transport. See
`apps/api/src/observability/scrub.ts` and `apps/web/lib/scrub.ts`.

#### PostHog env vars

| Var                              | Where      | Purpose                                       |
| -------------------------------- | ---------- | --------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`        | Web client | Project API key                               |
| `NEXT_PUBLIC_POSTHOG_HOST`       | Web client | Defaults to `https://us.i.posthog.com`        |
| `EXPO_PUBLIC_POSTHOG_KEY`        | Mobile     | Project API key (Babel-inlined at build time) |
| `EXPO_PUBLIC_POSTHOG_HOST`       | Mobile     | Defaults to `https://us.i.posthog.com`        |
| `EXPO_PUBLIC_SENTRY_DSN`         | Mobile     | Mobile-specific Sentry DSN                    |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | Mobile     | `production` / `staging`                      |

Web identifies on Clerk sign-in by Clerk `userId` (no email pushed).
Mobile identifies on device pairing by `deviceId` because mobile has
no Clerk session — the cashier signs in with a 4-digit PIN.

#### Telemetry opt-out

Owners can disable PostHog product analytics from `/dashboard/settings`
→ "Privacy & telemetry". The flag is a boolean column on
`organizations` synced through the existing orgs-on-sync EVENT loop;
mobile registers honor the flip reactively via
`posthog.optOut()` / `posthog.optIn()`.

Sentry crash reporting is intentionally NOT gated by this toggle:
events are PII-scrubbed at the SDK boundary, and operational
debugging shouldn't be at the mercy of a per-org preference. The
settings UI text says so explicitly.

### 2.10 Stripe (billing)

Phase A ships Stripe Checkout (hosted) + Customer Portal. Monthly PHP
billing only; no trial; no annual. The webhook is the only path that
flips `organizations.tier`.

1. **Stripe products + prices**: create one Product per paid tier
   (Pro, Business). Each gets a recurring monthly Price in **PHP**
   (`₱1,499` and `₱3,999` are the placeholders shown on the marketing
   page). Copy the Price ids (`price_…`) into `STRIPE_PRICE_PRO` and
   `STRIPE_PRICE_BUSINESS` env vars.
2. **Webhook**: point Stripe at `https://api.counter.app/api/v1/billing/webhook`.
   Subscribe to: `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copy the signing secret into Fly secrets
   as `STRIPE_WEBHOOK_SECRET`. (Local dev: run `stripe listen
--forward-to localhost:4000/api/v1/billing/webhook` and use the
   `whsec_…` value it prints.)
3. **Customer Portal**: enable in the Stripe dashboard
   (Billing → Customer Portal). Configure allowed actions (cancel,
   update payment method, view invoices); these surface in the portal
   UI without code changes here.
4. **Redirect URLs**: `BILLING_SUCCESS_URL` and `BILLING_CANCEL_URL`
   must be reachable from the cardholder's browser. Defaults point at
   `localhost:3000`.
5. **Test mode** keys live in dev/staging Vercel + Fly envs; live keys
   live in production only. The API tolerates missing Stripe env vars
   (returns 503 on billing endpoints) so non-Stripe tests still pass.

---

## 3 · Environments

| Environment  | API              | Web            | DB                | Redis        | R2            |
| ------------ | ---------------- | -------------- | ----------------- | ------------ | ------------- |
| `local`      | localhost:4000   | localhost:3000 | local Postgres    | local Redis  | MinIO         |
| `preview`    | Fly preview app  | Vercel preview | Neon dev branch   | Upstash dev  | R2 dev bucket |
| `production` | Fly prod (US/EU) | Vercel prod    | Neon prod (US/EU) | Upstash prod | R2 prod       |

Branch convention:

- `main` → production deploys via CI (deploys are still being wired
  to Fly + Vercel; CI today verifies lint + typecheck + build + tests).
- PRs → Vercel preview deployments are auto-created once the project
  is linked; Fly preview machines are not yet wired up.
- `staging` (optional) → long-running soak environment for sync work,
  if/when the multi-region rollout warrants it.

---

## 4 · Pre-flight checklist before first production deploy

- [ ] Domain `counter.app` purchased; DNS pointed at Cloudflare.
- [ ] Vercel project created, domains attached.
- [ ] Fly app(s) created with the right regions.
- [ ] Neon Postgres provisioned per region; migrations dry-run on prod URL.
- [ ] Upstash Redis provisioned per region.
- [ ] R2 buckets + scoped access key.
- [ ] Sentry projects (api, web, mobile) with DSNs in env.
- [ ] Stripe products + webhook + signing secret.
- [ ] Apple Developer + Google Play Console accounts; EAS configured.
- [ ] APK download endpoint smoke-tested.
- [ ] WebSocket sync verified across regions (write on US phone, see on EU dashboard).
- [ ] Free → Pro upgrade flow exercised end-to-end with Stripe test card.
- [ ] Account deletion / data export flow tested (HANDOFF §8 commitment).

---

## 5 · Updates to this guide

When environment, secrets, services, or commands change, **edit this file in the same PR**. The first AI agent (or human) onboarding from a stale DEPLOY.md is the one who pays the cost.
