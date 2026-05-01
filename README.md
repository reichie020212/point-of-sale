# Counter POS

A calm, offline-first point-of-sale for small independent shops — cafés, bakeries, boutiques, studios.

> Three surfaces, one account: a **mobile app** that lives in an apron pocket, a **web dashboard** for the back office, and a **marketing site** that distributes the apps and sells the paid tiers.

---

## Status

**W2–W8 master push landed.** Schema expansion, products + categories CRUD, sync (server + mobile client), mobile catalog/cart/cash checkout, web dashboards (products / customers / registers), KPI reports + charts, tier gating, devices API, and CSV import/export are all in place. See [`docs/blueprints/master-w2-w8.md`](./docs/blueprints/master-w2-w8.md) for the executed plan and [`docs/manual-test-plan.md`](./docs/manual-test-plan.md) for the human-driven verification gate (HANDOFF §4 W3 acceptance test). The W1 scaffold ([`docs/blueprints/week-1-scaffold.md`](./docs/blueprints/week-1-scaffold.md)) is the prerequisite.

---

## Surfaces

| Surface       | Where                        | What                                                                          |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| **Mobile**    | Android APK + iOS TestFlight | React Native register; offline-first; single-operator                         |
| **Dashboard** | `app.counter.app`            | Next.js back-office: products, orders, customers, reports, live registers     |
| **Marketing** | `counter.app`                | Next.js landing, pricing, downloads (same Next.js app, different route group) |
| **API**       | `api.counter.app`            | Fastify backend, Postgres + Redis, sync WebSocket                             |

---

## Stack

- **Mobile**: React Native + Expo (bare), TypeScript strict, Zustand, WatermelonDB, Expo Router
- **Web**: Next.js 14 App Router, Tailwind, TanStack Table, Recharts
- **API**: Node.js 20 + Fastify, Postgres 16, Redis 7, S3-compatible object store
- **Sync**: Custom WebSocket (primary) + HTTPS long-poll (fallback); Lamport-clock versioning; delta-CRDT for inventory
- **Tooling**: pnpm 9 workspaces + Turborepo

Full architecture, screens, sync rules, and non-negotiables: **[`HANDOFF.md`](./HANDOFF.md)**.

---

## Repo layout

```
.
├── HANDOFF.md                       ← engineering spec (source of truth)
├── docs/blueprints/                 ← architect (Gemini) Blueprints, week by week
├── Counter POS.html, Counter Web.html ← design prototypes (read-only references)
├── src/, web/, shared/              ← JSX prototype components (read-only)
│
├── apps/
│   ├── api/                         ← Fastify backend (Node 20)        ✓ W1
│   ├── web/                         ← Next.js 14 App Router            ✓ W1
│   └── mobile/                      ← React Native + Expo              · W2+
├── packages/
│   ├── tokens/                      ← OKLCH palette + typography       ✓ W1
│   ├── schema/                      ← Drizzle + Postgres definitions   ✓ W1
│   ├── sync/                        ← Sync engine                      · W3
│   ├── ui-web/                      ← shared React components          · W2
│   ├── ui-mobile/                   ← shared RN components             · W2
│   └── utils/                       ← money, time, receipt formatting  · W2
├── tooling/
│   ├── eslint/                      ← shared ESLint config + token rule
│   ├── eslint-fixtures/             ← passing/failing color-rule fixtures
│   ├── tsconfig/                    ← shared TS configs
│   └── prettier/                    ← shared Prettier config
│
├── .github/workflows/ci.yml         ← lint · typecheck · build · fixtures · API smoke
├── CLAUDE.md, GEMINI.md             ← agent instructions
├── DEPLOY.md                        ← local + production setup
└── README.md                        ← this file
```

---

## Quickstart

See **[`DEPLOY.md`](./DEPLOY.md)** for the full local + production setup. Minimum to get the W1 stack running:

```bash
# Prereqs: Node 20 LTS, pnpm 9, Postgres 16 (locally), a Clerk dev project.
pnpm install
cp apps/api/.env.example apps/api/.env       # fill DATABASE_URL + Clerk keys
cp apps/web/.env.example apps/web/.env       # fill Clerk publishable + secret keys
createdb counter_dev
DATABASE_URL=postgresql://localhost:5432/counter_dev pnpm --filter @counter/schema db:migrate
pnpm dev                                     # api on :4000, web on :3000
```

Common scripts (run from the repo root):

```bash
pnpm lint                                    # ESLint across all workspaces
pnpm typecheck                               # tsc --noEmit, every workspace
pnpm build                                   # turbo build (with cache)
pnpm format                                  # Prettier write
pnpm --filter @counter/eslint-config lint:fixtures   # token discipline check
pnpm --filter @counter/api test              # API smoke tests
```

---

## Pricing tiers

| Tier         | Price        | Includes                                                                   |
| ------------ | ------------ | -------------------------------------------------------------------------- |
| **Free**     | Free forever | Mobile app, local-only, 1 device, CSV import/export                        |
| **Pro**      | $29/mo       | + cloud sync, web dashboard, unlimited devices, 1 location, 90-day backups |
| **Business** | $79/mo       | + multi-location, team roles, advanced reports, REST API, webhooks         |

Required for Pro: web dashboard sign-in. Required for Business: org with > 1 location or > 5 team members.

---

## Non-negotiables

1. **Offline-first or nothing** — sales never block on a network call.
2. **Tokens are law** — no hard-coded colors outside `packages/tokens`.
3. **Money is monospace** — JetBrains Mono for every price and timestamp.
4. **Accessibility** — 44px touch targets, WCAG AA contrast.
5. **Free tier stays free** — sync is the only paywall.
6. **Your data is yours** — CSV/JSON export on every tier; deletion within 30 days.

Full list: [`HANDOFF.md`](./HANDOFF.md) §8.

---

## Working with AI agents

This repo uses an Architect / Executor split:

- **Gemini** owns Blueprints (architecture, schema, approach). See [`GEMINI.md`](./GEMINI.md).
- **Claude Code** executes Blueprints (writes the code, runs the tools, commits). See [`CLAUDE.md`](./CLAUDE.md).

When in doubt, the spec is HANDOFF.md and the visual source is the HTML prototypes.
