# Counter POS

A calm, offline-first point-of-sale for small independent shops — cafés, bakeries, boutiques, studios.

> Three surfaces, one account: a **mobile app** that lives in an apron pocket, a **web dashboard** for the back office, and a **marketing site** that distributes the apps and sells the paid tiers.

---

## Status

**Design phase.** The repo currently contains the engineering brief and design prototypes. Production code (`apps/`, `packages/`) is being scaffolded — see [`HANDOFF.md`](./HANDOFF.md) §7 for the build order.

---

## Surfaces

| Surface | Where | What |
|---|---|---|
| **Mobile** | Android APK + iOS TestFlight | React Native register; offline-first; single-operator |
| **Dashboard** | `app.counter.app` | Next.js back-office: products, orders, customers, reports, live registers |
| **Marketing** | `counter.app` | Next.js landing, pricing, downloads (same Next.js app, different route group) |
| **API** | `api.counter.app` | Fastify backend, Postgres + Redis, sync WebSocket |

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

Today the repo holds design references only:

```
.
├── HANDOFF.md             ← engineering spec (the source of truth)
├── Counter POS.html       ← mobile prototype (design reference)
├── Counter Web.html       ← dashboard + marketing prototype
├── src/                   ← mobile JSX prototype components
├── web/                   ← web JSX prototype components
├── shared/                ← shared JSX prototype components
├── CLAUDE.md              ← Claude Code agent instructions
├── GEMINI.md              ← Gemini (Architect) agent brief
├── DEPLOY.md              ← local + production setup guide
└── README.md              ← this file
```

Planned production layout (HANDOFF §6):

```
apps/
├── mobile/                React Native
├── web/                   Next.js (marketing + dashboard)
└── api/                   Fastify backend
packages/
├── tokens/                Design tokens (TS + CSS + RN variants)
├── ui-web/                Shared web components
├── ui-mobile/             Shared RN components
├── sync/                  Sync engine
├── schema/                Zod schemas + TypeScript types
└── utils/                 Money, time, receipt formatting
tooling/                   ESLint, tsconfig, Prettier, CI
```

---

## Quickstart

See **[`DEPLOY.md`](./DEPLOY.md)** for local development setup and production deployment. Once the monorepo is scaffolded, the local loop will be:

```bash
pnpm install
pnpm db:setup    # provisions Postgres + Redis (local services)
pnpm dev         # turbo runs api, web, mobile (Expo) in parallel
```

---

## Pricing tiers

| Tier | Price | Includes |
|---|---|---|
| **Free** | Free forever | Mobile app, local-only, 1 device, CSV import/export |
| **Pro** | $29/mo | + cloud sync, web dashboard, unlimited devices, 1 location, 90-day backups |
| **Business** | $79/mo | + multi-location, team roles, advanced reports, REST API, webhooks |

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
