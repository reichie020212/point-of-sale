# Blueprint: User Roles (RBAC) & Tax/Currency Schema

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §9 (Policy Decisions) — first build-out

## 1. Goal

Lay the §9 schema foundation in one commit: three-tier RBAC enum on
`users`, `organizations.currency` + `organizations.tax_rate` columns
for PH defaults, and `'PH'` added to the `region` enum. Wire a
server-side `requireRole` preHandler and gate every catalog,
device, import/export, and org-mutation route against it.

## 2. Why this next?

- §9 closed 2026-05-03: every Blueprint going forward (Stripe billing,
  refund flow, loyalty, team invites) assumes these columns exist. RBAC
  is a *prerequisite* for all of them — Stripe billing must be owner-
  only, refunds must check role, team-invites need role assignment.
- Smallest §9 schema move that covers three slices at once. Skipping
  the schema-only step would mean every future Blueprint re-touches
  `auth.ts`.
- No UI surface yet. Web team-management and a tax-aware checkout will
  land in their own Blueprints; this commit just makes the columns
  exist with the right defaults.

## 3. Implementation Strategy

- **One pgEnum, three values.** `user_role` = `owner | manager | cashier`.
  Stored on `users.role` (single column, not a memberships join table)
  because v1 is one-user-per-org; the multi-org model can migrate later
  by moving the column without changing values.
- **§9 PH defaults baked in.** `organizations.currency` defaults to
  `'PHP'`, `tax_rate` defaults to `'12.000'` (numeric(5,3) so a future
  zero-rated exemption can use `0.000` without precision loss).
- **`'PH'` added, `'US'`/`'EU'` retained.** Existing test fixtures use
  `'US'`, and we don't want to migrate them. Postgres `ALTER TYPE ADD
  VALUE` is appended to the enum; `region` is now `('US', 'EU', 'PH')`.
- **Authz preHandler mirrors `requireTier`.** `requireRole(['owner',
  'manager'])` looks up `users.role` by `clerkUserId` and returns 403
  with `{error: 'role_required', currentRole, requiredRoles}` on miss.
  Device-token requests are rejected outright — paired registers
  represent the org but cannot do admin work.
- **Reads stay open.** Every member of an org can list catalog,
  customers, dashboard. Mutations on catalog/devices/imports/exports/
  org settings require `['owner', 'manager']`. Billing endpoints don't
  exist yet; when they land they'll be `['owner']`.
- **Org creator is the owner.** `POST /api/v1/orgs` already updates
  `users.activeOrgId`; that same UPDATE now sets `role: 'owner'`.
  Subsequent invitees default to `cashier` per the column default.
- **Test fixtures explicitly seed roles.** Existing
  `integration.test.ts` and `pairing.test.ts` now seed `role: 'owner'`
  so their POST flows aren't 403'd by the new gate. A new
  `authz.test.ts` exercises the gate itself (cashier-blocked,
  manager-allowed, owner-allowed, reads-not-gated).

## 4. Execution Steps (Single Commit: `feat(api,schema): rbac roles + tax/currency columns`)

### Step 1 — Schema (`packages/schema/src/auth.ts`)
- New `pgEnum('user_role', ['owner', 'manager', 'cashier'])`.
- `'PH'` appended to `region` enum.
- `organizations.currency text NOT NULL DEFAULT 'PHP'`.
- `organizations.taxRate numeric(5,3) NOT NULL DEFAULT '12.000'`.
- `users.role user_role NOT NULL DEFAULT 'cashier'`.
- Re-export `userRole` + `UserRole` from `packages/schema/src/index.ts`.

### Step 2 — Migration
- `pnpm --filter @counter/schema db:generate` produces
  `drizzle/0005_green_ezekiel_stane.sql`. Sequence:
  1. `CREATE TYPE user_role`
  2. `ALTER TYPE region ADD VALUE 'PH'`
  3. `ALTER TABLE organizations ADD COLUMN currency`
  4. `ALTER TABLE organizations ADD COLUMN tax_rate`
  5. `ALTER TABLE users ADD COLUMN role`

### Step 3 — Authz preHandler (`apps/api/src/auth/role.ts`)
- New file. `requireRole(allowed: UserRole[]): preHandlerHookHandler`.
- Rejects device-token requests (`request.auth.deviceOrgId` set) with
  403 + `role_required`.
- Looks up `users.role` by `clerkUserId`. Missing user record → 403
  `no_user_record`. Role not in allowed → 403 `role_required` with
  `currentRole` + `requiredRoles` for client branching.

### Step 4 — Route gating
- `products.ts`: POST/PATCH/DELETE → `requireRole(['owner', 'manager'])`.
- `categories.ts`: POST/PATCH/DELETE → `requireRole(['owner', 'manager'])`.
- `orgs.ts`: PATCH `/api/v1/orgs/active` → `requireRole(['owner', 'manager'])`.
  POST `/api/v1/orgs` is *not* gated (creating a new org is what
  promotes a user to owner). Region zod enum now accepts `'PH'`.
  POST `/api/v1/orgs` UPDATE statement now sets `role: 'owner'` on the
  creator alongside `activeOrgId`.
- `devices.ts`: POST `/code` and POST `/:id/revoke` get tier+role chain
  `[requireTier(['pro','business']), requireRole(['owner','manager'])]`.
- `imports.ts`: POST `/imports/products` gets the same tier+role chain.
- `exports.ts`: POST `/exports` gated by `requireRole`. GET stays open
  (the file is already authorized by org membership).

### Step 5 — Test updates
- `integration.test.ts` and `pairing.test.ts`: seed user with
  `role: 'owner'` so their POST flows pass the new gate.
- New `apps/api/test/authz.test.ts`:
  1. Seeds an org with `region: 'PH'` and a user starting as `cashier`.
  2. Promotes the user role between subtests.
  3. Asserts cashier → 403 `role_required` on POST `/products`,
     PATCH `/orgs/active`, POST `/exports`.
  4. Asserts cashier → 200 on GET `/products` (read not gated).
  5. Asserts manager → 201 on POST `/products`.
  6. Asserts owner → 201 on POST `/products`.
  7. Skips when DATABASE_URL unreachable, mirroring sibling suites.

### Step 6 — Verify
- `pnpm --filter @counter/schema db:generate` clean (no extra diffs).
- `pnpm --filter @counter/schema build && pnpm typecheck && pnpm lint
  && pnpm build` all green.
- `pnpm --filter @counter/api test` runs and the authz test joins the
  CI service-container suite (skips locally without Postgres).

## 5. Definition of Done

- [x] `user_role` pgEnum exists; `users.role` column added with default
      `'cashier'`.
- [x] `organizations.currency` and `organizations.tax_rate` columns
      added with PH defaults.
- [x] `'PH'` added to `region` enum without breaking existing US/EU
      fixtures.
- [x] `requireRole` preHandler enforces RBAC on every catalog,
      device, import/export, and org-mutation route.
- [x] `POST /api/v1/orgs` promotes the creator to `owner`.
- [x] Existing integration tests still pass (with role seeded).
- [x] New authz test asserts the cashier-blocked, manager-allowed,
      owner-allowed matrix.
- [x] Lint, typecheck, monorepo build all green.

## 6. Open questions resolved at execution time

- **Region enum:** added `'PH'` without dropping `'US'`/`'EU'`. The
  enum is used as a shard hint for Neon; we'll likely never sit a
  PH org on a US/EU shard, but the existing test fixtures use US, and
  enum migration with data backfill isn't worth the friction in v1.
- **Why `users.role` not `memberships.role`:** v1 has one user → one
  org. Memberships join becomes necessary the day Counter supports
  cross-org users; until then the column lives on `users` and a future
  migration moves it. The role default `'cashier'` is the right
  "least surprise" — invitees from a future team-invite flow won't
  accidentally get owner.
- **Device-token requests on admin routes:** rejected with 403 instead
  of "treated as cashier". A paired register isn't a person; it has
  no role. Admin work happens on the dashboard (Clerk-authed) only.
- **Reads stay open:** cashier needs `GET /products` for the sell
  flow, `GET /customers` for lookup, `GET /reports/dashboard` for
  shift summaries. Gating reads would break the register UX without
  improving security (the data is already org-scoped).
- **POST /orgs not gated:** the very act of creating an org is what
  promotes the user to owner. Gating it would create a chicken-and-
  egg where no one can ever onboard.
- **Tax/currency columns added but no UI yet:** §9 spec says cart math
  uses `tax_rate × subtotal` at checkout; that lands in a follow-up
  Blueprint that touches the mobile cart, web settings UI, and
  receipt renderer. This commit just makes the columns exist with
  the right PH defaults so the next Blueprint doesn't have to migrate
  the schema *and* wire UI in one commit.
