# CLAUDE.md — Counter POS

Instructions for Claude Code working in this repo. Reads in addition to the user's global `~/.claude/CLAUDE.md`. Where this file conflicts with the global, **this file wins**.

---

## Project in one paragraph

**Counter** is a calm, offline-first point-of-sale for small independent shops. Three surfaces share one account: a **mobile app** (React Native + Expo, Android APK + iOS TestFlight), a **web dashboard + marketing site** (Next.js 14, `app.counter.app` and `counter.app`), and a **backend** (Node.js + Fastify, Postgres, Redis). A custom WebSocket-based **sync engine** keeps them coherent. The authoritative spec is [`HANDOFF.md`](./HANDOFF.md); the visual source of truth is `Counter POS.html` and `Counter Web.html` plus the JSX prototypes in `src/`, `web/`, and `shared/`.

---

## Repo-specific overrides

### 1. Do **not** use git worktrees in this repo

The user's global rule mandates worktrees for all work. **This repo opts out.** Commit on the active branch directly. The "always use a worktree" rule does not apply here.

### 2. Treat `HANDOFF.md` as the spec

HANDOFF defines stack, screens, sync rules, and non-negotiables. The HTML/JSX prototypes win on visual detail; HANDOFF wins on architecture and behavior. If a request contradicts HANDOFF, surface the conflict before implementing.

### 3. Visual-prototype files are reference, not production

`Counter POS.html`, `Counter Web.html`, `src/*.jsx`, `web/*.jsx`, `shared/*.jsx` are React-via-Babel-standalone prototypes. They are **read-only design source**. Do not edit them as if they were the app. Production code lives under `apps/` and `packages/` (now fully scaffolded — see "Current state" below).

### 4. Architect / Executor split

For project work in this repo, **Gemini is the Architect** (owns Blueprints) and **Claude is the Executor** (implements Blueprints). When a roadblock requires a design change, re-consult Gemini via `/ask gemini` rather than improvising. Read `GEMINI.md` for the Architect's brief.

---

## Inherited rules (from global CLAUDE.md, restated for emphasis)

- **Always sign commits with both `-s` and `-S`**: `git commit -s -S -m "..."`. Every commit, no exceptions.
- **No self-attribution.** No `Co-Authored-By: Claude`, no "Generated with Claude Code" footer.
- **Conventional Commits prefix.** `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
- **Linter + formatter before every commit.** Once tooling lands, that means `pnpm lint && pnpm format`. Do not skip pre-commit hooks (`--no-verify` forbidden).
- **Fail fast.** On a non-obvious error or unresolved traceback, stop and report full output. Do not silently retry or hack around it. Re-consult Gemini.

---

## Counter non-negotiables (from HANDOFF §8)

1. **Offline-first or nothing.** Never block a user action on a network call. No spinners on sell actions.
2. **Tokens are law.** No hard-coded colors, font families, or radii outside `packages/tokens`. ESLint rule should enforce once tokens land.
3. **Every price is JetBrains Mono.** Every timestamp is JetBrains Mono. Money never renders in a proportional font.
4. **Accessibility:** 44px minimum touch target on mobile, WCAG AA contrast on web, keyboard-navigable tables, screen-reader labels on every icon button.
5. **Free tier stays free forever.** No dark patterns. Sync gating is the only paywall.
6. **Your data is yours.** CSV/JSON export works on every tier. Account delete wipes within 30 days.

---

## HANDOFF §9 closed decisions (locked 2026-05-03)

All six open questions from HANDOFF §9 are answered. Implement these without re-asking; if a Blueprint needs a variation, flag the conflict to the user.

- **Region & currency**: PH only (`organizations.region = 'PH'`, `currency = 'PHP'`, ₱ + en-PH).
- **Tipping**: Fixed-amount entry only — no percent presets. Schema: `orders.tip_cents` exists; cart screen shows a single "Add tip" → numeric input. Receipts render the tip line only when > 0.
- **Tax engine**: Single flat rate per org. `organizations.tax_rate` is `numeric(5,3)`, default `12.000` for PH VAT. Subtotal × rate computed locally on the device.
- **Refund rules**: Full or partial, no time limit, reason required (free-text). Refund flow: itemized selection (cashier picks per-item quantity), reason captured at submit. Refunds are new rows referencing the original order; orders are append-only. Tip is **all-or-nothing** — released only on a closing-out refund. Tax + discount pro-rate by subtotal share; the closing-out refund captures the floor() remainder so cumulative refunds match the order line-for-line.
- **Loyalty model**: Punchcard (Nth purchase free). Per-product (or per-category) punch counter on the customer record; cashier taps "redeem" when threshold hits.
- **Team RBAC**: 3 roles — owner / manager / cashier. `users.role` enum; default `cashier`. Owner = everything; manager = everything except billing + team management; cashier = sell + refund only. Server-side authz enforced; mobile UI hides cashier-blocked actions; web rejects.

---

## Current state (2026-05-05)

The repo is fully scaffolded and the W2–W8 master push has landed. Notable completed arcs (see `docs/blueprints/` for the full list):

- **Foundation**: monorepo scaffold, design tokens, auth (Clerk), product CRUD, sync engine, offline-first cart + cash checkout, dashboard reports, customers + loyalty (punchcard), registers + device pairing, CSV import/export, Stripe billing Phase A, observability A+B (Sentry + PostHog with telemetry opt-out), tier gating.
- **Sales integrity**: tax-aware checkout, tipping + admin polish, refund flow with breakdown columns + per-line qty tracking + closing-out math, refund history list (mobile + web), refund receipt formatter (`packages/printers`), web orders dashboard with Print receipt buttons.
- **Schema state**: orders are append-only with subtotal/tax/tip/discount/total. Refunds carry `subtotal_cents`/`tax_cents`/`tip_cents`/`discount_cents`/`line_qtys_json` — see `packages/schema/src/sales.ts` and Drizzle migrations 0013 (breakdown) + 0014 (line qtys).
- **Tests**: 104 mobile pure-helper tests, 11 printer formatter tests, 52 API tests passing locally; DB-backed integration + sync-push suites auto-skip when `DATABASE_URL` is unreachable and run in CI on a Postgres service container.

What is **not** done (per the audit, no hardware required):

- Stripe billing Phase B — in-product cancel/downgrade flow (Phase A's portal redirect works; in-product cancel does not).
- Account-deletion flow — HANDOFF §8 commits to "wipes within 30 days" but no schema column / endpoint / UI exists yet.
- Refund analytics on the dashboard reports page (additive polish, not a spec gap).

What is not done **and needs hardware** (W5):

- BLE thermal printer (`packages/printers/src/ble.ts` is scaffolded; throws `not implemented`). Needs a paired Star/Epson device + `react-native-ble-plx`.
- Stripe Terminal SDK in `packages/payments/src/stripe.ts`. Needs a real card reader.
- Real device-token flow — `apps/api/src/auth/clerk.ts` uses `sessionId` as a placeholder `deviceId`; `apps/web/app/onboarding/actions.ts` has a TODO(W5) stub for the same.

The full deployment pre-flight checklist lives in [`DEPLOY.md`](./DEPLOY.md) §4 — none of those items are code work.

---

## Stack reference (per HANDOFF)

| Surface | Tech                                                                                      |
| ------- | ----------------------------------------------------------------------------------------- |
| Mobile  | React Native + Expo (bare), TypeScript strict, Zustand, WatermelonDB, Expo Router         |
| Web     | Next.js 14 App Router, TypeScript strict, Tailwind, TanStack Table, Recharts              |
| API     | Node.js 20 + Fastify, TypeScript strict, Postgres 16, Redis 7, S3-compatible object store |
| Sync    | Custom WebSocket + HTTPS fallback, Lamport-clock per org, delta-CRDT for inventory        |
| Tooling | pnpm 9 workspaces + Turborepo, one ESLint config, one Prettier config, one tsconfig base  |

Monorepo layout (HANDOFF §6, current):

```
apps/{api,mobile,web}
packages/{eslint-config,payments,prettier-config,printers,schema,sync,tokens,tsconfig,ui-mobile}
tooling/{eslint,eslint-fixtures,prettier,tsconfig}
docs/{blueprints,manual-test-plan.md,RESUME.md}
```

Setup, env vars, and deployment topology live in [`DEPLOY.md`](./DEPLOY.md). Manual QA gates (W3 acceptance test + hardware-dependent flows) live in [`docs/manual-test-plan.md`](./docs/manual-test-plan.md).

---

## Working agreements

- When starting non-trivial work, check `GEMINI.md` and `docs/blueprints/` for a recent Blueprint before coding. The architect/executor split still holds for new feature work.
- When the spec is silent, prefer the prototype's visible behavior and flag the assumption in the commit/PR.
- Update this file when (a) a new repo-specific rule is established or (b) an inherited rule is overridden.
- Update `GEMINI.md` whenever the Architect's brief shifts (new constraints, new open questions, completed milestones).
- Update `README.md` whenever onboarding facts change (stack, layout, commands).
- Update `DEPLOY.md` whenever environment/setup steps change.

---

## Operational notes for the next session

- **Mobile API URL**: the app reads `Constants.expoConfig?.extra?.apiUrl` and falls back to `http://localhost:4000`. iOS Simulator works with the default; Android emulator needs `http://10.0.2.2:4000`; physical devices need a LAN IP or tunnel. Set in `apps/mobile/app.json`'s `expo.extra.apiUrl` if you need to point elsewhere.
- **DB-backed tests skip gracefully**: `apps/api/test/integration.test.ts` and `apps/api/test/sync-push.test.ts` no-op if `DATABASE_URL` isn't reachable. CI brings up Postgres + Redis as services and runs them on every push. To run locally: `createdb counter_test`, then `DATABASE_URL=postgresql://localhost:5432/counter_test pnpm --filter @counter/schema db:migrate && pnpm --filter @counter/api test`.
- **Push policy**: per the user's auto-memory, each "push to origin/main" grant covers a single push. Re-ask before subsequent pushes. The repo hooks enforce this — multiple pushes per turn get blocked.
- **Drizzle migrations are checked in**: `pnpm --filter @counter/schema db:generate` writes to `packages/schema/drizzle/`. Always commit the generated SQL + `meta/_journal.json` + the new snapshot.
- **JSON columns over the wire**: any `*_json` column on a sync table is stored as a string locally (WatermelonDB) and as `jsonb` server-side. The mobile coerce helper in `apps/mobile/src/sync/upsert.ts` handles object↔string conversion generically, and the API service writer in `apps/api/src/sync/service.ts` accepts either.
