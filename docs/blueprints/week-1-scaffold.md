# Week 1 Blueprint: Monorepo Scaffold, Tokens, and Auth

**Status**: Approved — execution in progress
**Context**: HANDOFF §7 Item 1
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-01

## 1. Monorepo File Tree

```text
/
├── apps/
│   ├── api/                 # Fastify (Node 20)
│   ├── mobile/              # RN + Expo (Bare) — scaffold only
│   └── web/                 # Next.js 14 (App Router)
├── packages/
│   ├── schema/              # Drizzle + Postgres 16 definitions
│   ├── sync/                # Shared sync logic (types only in W1)
│   ├── tokens/              # Design tokens (TS + CSS + RN)
│   ├── ui-web/              # React components (W1: Button/Card stubs)
│   └── utils/               # Money, time, formatting
├── tooling/
│   ├── eslint/              # Custom rules (incl. no-hardcoded-colors)
│   ├── tsconfig/            # Shared TS configs
│   └── prettier/            # Shared formatting
├── .eslintrc.js
├── .prettierrc
├── .nvmrc
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── pnpm-lock.yaml
```

## 2. Pinned Dependencies (v1)

- `node`: `20.12.2` (LTS)
- `pnpm`: `9.0.5`
- `turbo`: `1.13.2`
- `typescript`: `5.4.5`
- `next`: `14.2.3`
- `fastify`: `4.26.4`
- `@clerk/nextjs`: `5.0.12`
- `drizzle-orm`: `0.30.10`
- `postgres`: `3.4.4`
- `tailwindcss`: `3.4.3`
- `lucide-react`: `0.378.0`

## 3. @counter/tokens Design

The tokens package will be the "law" for visuals.

### File Structure
- `src/colors.ts` — OKLCH values with hex fallbacks
- `src/typography.ts` — Inter, JetBrains Mono, Fraunces definitions
- `src/index.ts` — unified export
- `src/platforms/web.css` — CSS variables
- `src/platforms/native.ts` — RN-optimized theme object

### Typography Rules
- **Money / timestamps**: `font-family: 'JetBrains Mono', monospace;`
- **UI / body**: `font-family: 'Inter', sans-serif;`
- **Display**: `font-family: 'Fraunces', serif;`

### ESLint Enforcement (Week 1: regex-based)

- Mechanism: `no-restricted-syntax` + `no-restricted-imports` rules in `tooling/eslint`, applied to `apps/**` and `packages/!(tokens)/**`.
- Patterns blocked in string/template literals: hex (`#abc`, `#aabbcc`, `#aabbccdd`), `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, `oklch(...)`, `oklab(...)`.
- `packages/tokens/**` is whitelisted via overrides.
- Two test fixtures land alongside the rule: one that passes (uses `tokens.color.accent`), one expected to fail (uses `'#FF00FF'`). The failing fixture lives behind a `// eslint-expect-error` comment so CI can verify the rule fires.
- A proper AST plugin (`@counter/eslint-plugin`) graduates from this stub when the rule needs context (e.g. distinguishing a literal in a comment from a real color).

## 4. Auth Flow (Week 1)

**Auth choice**: **Clerk**. Provides the fastest path to robust multi-tenancy (Organizations), which is core to Counter.

### Session / Device Token Integration
- Clerk JWT template: `counter-sync-v1`
- Custom claims: `{ "org_id": "{{org.id}}", "device_id": "{{session.id}}" }`
- Rationale: For Week 1, the web browser session *is* the device. In Week 5 / 6, an explicit `devices` table for paired mobile hardware will be added.

### DB Schema (Postgres 16 + Drizzle)

Decoupled from Clerk: internal UUID PKs + indexed `clerk_*_id` columns. `region` is a Postgres enum, not free-form text.

```typescript
// packages/schema/src/auth.ts
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const region = pgEnum('region', ['US', 'EU']);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  region: region('region').notNull(),  // HANDOFF §5
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  activeOrgId: uuid('active_org_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### API Endpoints
- `POST /api/v1/auth/sync` — sync Clerk metadata with local DB on login (webhook fallback)
- `GET /api/v1/orgs` — list user organizations
- `POST /api/v1/orgs` — create organization with region pinning

## 5. Order of Operations for Claude

1. **feat: init monorepo scaffold** — root config files (`package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.nvmrc`); set up `tooling/tsconfig` and `tooling/eslint`.
2. **feat: implement @counter/tokens** — build the package with OKLCH colors from HANDOFF §1; export CSS variables and TS theme objects; add the custom ESLint rule to `tooling/eslint`.
3. **feat: setup @counter/schema** — initialize Drizzle with `organizations` and `users` tables; configure region-pinning logic (US / EU).
4. **feat: scaffold apps/api** — Fastify server with Clerk middleware; connect to Postgres 16 (local dev setup).
5. **feat: scaffold apps/web** — Next.js 14 App Router; integrate Tailwind with `@counter/tokens`; install Clerk and configure `(marketing)` and `(dashboard)` route groups.
6. **feat: implement signup and org creation** — sign-up page with Clerk `<SignUp />`; post-signup flow: "Create your Shop" (org name + region picker). `TODO(open-question)`: tax engine selection (placeholder in Org Settings).
7. **test: verify auth and tokens** — smoke test: login → create org → view dashboard with correct tokens.

## 6. Definition of Done

- `pnpm install` runs clean, lockfile committed.
- `pnpm typecheck` passes across all workspaces.
- `pnpm lint` passes (verifies no hard-coded colors in `apps/**` and non-tokens packages).
- The `no-restricted-syntax` color rule has one passing fixture and one expected-to-fail fixture; CI verifies both.
- `pnpm build` succeeds for all packages and apps.
- User can sign up, pick a region (US / EU), and reach a dashboard at `app.counter.app/dashboard` (locally `localhost:3000/dashboard`).
- "Price" elements in the dashboard use JetBrains Mono (visual smoke check).
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + typecheck + build on every PR.

## 7. Punted to Week 2+

- **Sync engine** — `packages/sync` will only contain TypeScript interfaces in W1.
- **Mobile app** — `apps/mobile` will be an empty Expo scaffold.
- **Billing** — Stripe integration deferred to Week 7.

---

## Decisions locked before execution

These were calibration questions raised by the Executor; the user authorized "your judgment" on all of them. Decisions:

1. **Clerk** accepted; W1 uses the free tier; paid tier (for Organizations) deferred until org-management features actually require it. `TODO(billing)`: confirm the Clerk plan that unlocks Organizations + custom JWT templates before going to production.
2. **Drizzle ORM** confirmed.
3. **DB decoupled from Clerk.** Schema uses internal UUID PKs + `clerk_org_id` / `clerk_user_id` indexed columns. Cost: one extra unique index per table; benefit: provider-portable schema.
4. **"Session = device" approximation** accepted for W1. JWT template shape is the durable artifact. `TODO(W5)` markers placed where the future `devices` table will replace this.
5. **ESLint rule** ships as `no-restricted-syntax` + regex in W1. A real AST plugin (`@counter/eslint-plugin`) graduates later if we need context-aware checks.
6. **DoD tightened** to include `pnpm typecheck`, the rule fixtures, and a GitHub Actions CI stub.
7. **Free-tier-no-account** captured as `TODO(open-question)` near the auth gate so mobile W2+ doesn't inherit the web sign-up gate by accident.
