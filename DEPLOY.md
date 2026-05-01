# DEPLOY.md — Counter POS

Local development setup and production deployment guide.

> **Note on Docker Compose.** Counter's production targets (Fly.io / managed Postgres / managed Redis / EAS Build for mobile) don't compose cleanly into a single `docker-compose.yml`, and the mobile app cannot be containerized at all. This guide uses native installs for local dev and platform deployments for production. If you specifically need a containerized local stack later, it can be added as `docker-compose.local.yml` covering only `api + postgres + redis + minio`.

---

## Status

This guide is **forward-looking**. The repo currently contains design references only; the monorepo (`apps/`, `packages/`) is being scaffolded. Sections marked **(planned)** describe how the system will be deployed once it exists.

---

## 1 · Local development

### 1.1 Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | **20 LTS** | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| pnpm | **9.x** | `npm i -g pnpm@9` or `corepack enable && corepack prepare pnpm@latest --activate` |
| PostgreSQL | **16.x** | `brew install postgresql@16` (macOS) / `apt install postgresql-16` (Debian) |
| Redis | **7.x** | `brew install redis` / `apt install redis-server` |
| Watchman | latest | `brew install watchman` (required by React Native on macOS) |
| Java JDK | **17** | `brew install --cask zulu@17` (Android builds) |
| Xcode | **15+** | App Store (iOS builds; macOS only) |
| Android Studio | latest | [developer.android.com/studio](https://developer.android.com/studio) (Android builds) |
| EAS CLI | latest | `npm i -g eas-cli` (Expo Application Services for mobile builds) |

Verify the basics:

```bash
node --version    # v20.x
pnpm --version    # 9.x
psql --version    # 16.x
redis-cli ping    # PONG
```

### 1.2 First-time setup (planned)

```bash
git clone <repo-url> counter
cd counter
pnpm install                      # installs all workspace packages

# Local services
brew services start postgresql@16 # macOS — adjust for your OS
brew services start redis

# DB bootstrap
pnpm db:create                    # createdb counter_dev
pnpm db:migrate                   # runs migrations in apps/api
pnpm db:seed                      # seeds dev fixtures

# Environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
# Fill in: DATABASE_URL, REDIS_URL, JWT_SECRET, S3 creds (MinIO local), Stripe test keys
```

### 1.3 Run the dev loop (planned)

Single command brings up the API, the web app, and the Expo dev server in parallel via Turborepo:

```bash
pnpm dev
```

Or individually:

```bash
pnpm --filter api dev             # http://localhost:4000
pnpm --filter web dev             # http://localhost:3000
pnpm --filter mobile dev          # Expo dev server; press i / a to launch sim
```

Default ports:

| Service | Port | Notes |
|---|---|---|
| API (Fastify) | 4000 | REST + `/sync` WebSocket |
| Web (Next.js) | 3000 | Marketing + dashboard route groups |
| Postgres | 5432 | DB name `counter_dev` |
| Redis | 6379 | pub/sub + rate limiting |
| Expo Metro | 8081 | Mobile bundler |

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
pnpm lint                         # ESLint across all workspaces
pnpm format                       # Prettier write
pnpm typecheck                    # tsc --noEmit, every workspace
pnpm test                         # Vitest / Jest, per workspace
pnpm --filter api db:migrate      # run new migrations
pnpm --filter api db:reset        # drop + recreate + seed (dev only)
```

### 1.6 Mobile development specifics

```bash
cd apps/mobile
pnpm dev                          # starts Metro
# In another terminal:
pnpm ios                          # builds + launches in iOS sim (macOS only)
pnpm android                      # builds + launches in Android emulator
```

For physical devices, install **Expo Go** during early development. Once native modules land (BLE printer, barcode scanner, payments), use a custom dev client built with `eas build --profile development`.

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

| Record | Target |
|---|---|
| `counter.app` (A/CNAME) | Vercel |
| `app.counter.app` (CNAME) | Vercel |
| `api.counter.app` (CNAME) | Fly.io app |
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

| Concern | Tool |
|---|---|
| Error tracking | Sentry (api + web + mobile) |
| Product analytics | PostHog |
| Logs | Fly logs → Logtail / Axiom (long-term retention) |
| Uptime | Better Uptime / Cronitor probing `/healthz` and the WebSocket handshake |

### 2.10 Stripe (billing)

1. Create Stripe products: **Pro** ($29/mo, $290/yr), **Business** ($79/mo, $790/yr).
2. Create a 14-day Pro trial price, no card required.
3. Webhook: `https://api.counter.app/webhooks/stripe` — set the signing secret in Fly secrets as `STRIPE_WEBHOOK_SECRET`.
4. Test mode keys live in dev/staging Vercel + Fly envs; live keys live in production only.

---

## 3 · Environments

| Environment | API | Web | DB | Redis | R2 |
|---|---|---|---|---|---|
| `local` | localhost:4000 | localhost:3000 | local Postgres | local Redis | MinIO |
| `preview` | Fly preview app | Vercel preview | Neon dev branch | Upstash dev | R2 dev bucket |
| `production` | Fly prod (US/EU) | Vercel prod | Neon prod (US/EU) | Upstash prod | R2 prod |

Branch convention (planned):

- `main` → production deploys via CI
- PRs → Vercel preview + Fly preview machine
- `staging` (optional) → long-running soak environment for sync work

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
