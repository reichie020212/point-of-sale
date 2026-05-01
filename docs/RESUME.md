# Resume — Counter POS master push

This file is the next-session entry point. Last updated 2026-05-01.

The user (Red) drove this over a long session in auto mode, asked for **all of HANDOFF §7 W2–W8 done in one push**, dropped the per-week cadence in favour of one consolidated Blueprint, and authorized "your judgment" on calibration questions. Hit the token limit mid-M10. Plan to use `/clear` or `/compact` then resume from this file.

---

## Where we are

### Committed (22 signed commits on `main`)

W1 (DoD met — per `docs/blueprints/week-1-scaffold.md`):

| SHA       | Subject |
|-----------|---------|
| `212ab44` | chore: import Counter POS design source |
| `e52df54` | docs: add CLAUDE.md, GEMINI.md, README.md, DEPLOY.md |
| `5111b6b` | docs: add Week 1 Blueprint (approved) |
| `7e500b0` | feat: init monorepo scaffold |
| `5af4c7e` | feat: implement @counter/tokens design tokens package |
| `f5381db` | feat: setup @counter/schema with Drizzle |
| `51a77bd` | feat: scaffold apps/api Fastify server |
| `a19996a` | feat: scaffold apps/web Next.js 14 dashboard + marketing |
| `e461a02` | chore: gitignore tsbuildinfo + next-env.d.ts |
| `d5774b1` | feat: implement signup and org creation flow |
| `a041a4c` | test+ci: GitHub Actions, API smoke tests, fixture verification |

W2–W8 master push (per `docs/blueprints/master-w2-w8.md`):

| SHA       | Step | Subject |
|-----------|------|---------|
| `0c1e1f4` | —   | docs: add master Blueprint for HANDOFF §7 weeks 2-8 |
| `729beec` | M1  | feat(schema): core domain expansion |
| `0a79c30` | M2  | feat(api): product CRUD + categories endpoints |
| `9ab50dd` | M3  | feat(sync): WebSocket server + Lamport pull |
| `d321371` | M4  | feat(mobile): expo + watermelondb scaffold |
| `e9815dd` | M5  | feat(mobile): catalog + cart + cash checkout |
| `04a7470` | M6  | feat(sync): mobile sync client |
| `997e5ec` | M7  | feat(web): products + registers dashboards |
| `5a7dbdf` | M8  | feat(payments,printers): hardware interfaces |
| `a9f4ff4` | M9  | feat(payments): wire cash + mock flows |

### Uncommitted — **M10 in progress**

Files changed but not yet committed (verified `pnpm typecheck` + `pnpm lint` clean before the interruption, just hadn't run `pnpm format` + commit yet):

```
M apps/api/src/server.ts                    # adds customerRoutes registration
?? apps/api/src/routes/customers.ts         # new — list/create/patch endpoints, ilike search
?? apps/web/app/(dashboard)/dashboard/customers/page.tsx  # new — search + list view
```

To finish M10 cleanly:

```bash
cd /Users/red/point-of-sale
pnpm format
pnpm --filter @counter/api typecheck
pnpm --filter @counter/api lint
pnpm --filter @counter/api test
git add -A
git commit -s -S -m "feat(customers): loyalty + history (M10)

Per master Blueprint §8 step 10.

API:
- GET    /api/v1/customers       (q + cursor pagination, ilike on
                                  name / email / phone)
- POST   /api/v1/customers
- PATCH  /api/v1/customers/:id   (loyaltyPoints adjustable)
- All org-scoped + soft-delete aware.

Web dashboard:
- /dashboard/customers — search + table view of name / email / phone /
  loyalty balance (rendered in monospace as a USD currency).

Loyalty: 1% earn-rate constant kept implicit in the data model for
now (TODO(policy-loyalty)). Movements ledger lands once the loyalty
model is locked."
```

---

## Remaining work — M11 → M14

Each lands as a single signed commit. Verification expectations: `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @counter/api test` clean before each commit.

### M11 — `feat(reports): KPI cards + charts`

Web `/dashboard` already has placeholder KPI cards from W1. Replace with a real Recharts-backed implementation.

- Add `recharts` (^2.13.x) to `apps/web/package.json`.
- Add API endpoint `GET /api/v1/reports/dashboard` that returns:
  - Today's gross / orders / avg ticket / net (deltas vs yesterday).
  - Sales-over-time series for Today / 7d / 30d / 90d (5-min / 1-h / daily buckets).
  - Top items array.
- Expose a server component on `/dashboard` that calls it; render four KPI cards with sparklines and a `<LineChart>` with the toggle.
- Highlight the current hour band on the chart (HANDOFF §3).
- Use `@counter/tokens` colors via the existing CSS-variable shim — no hard-coded hex literals; lint will catch slip-ups.

### M12 — `feat(billing): tier gating middleware`

`organizations.tier` enum already lives on the schema (M1 added it). Now enforce it.

- API: add a `requireTier(['pro', 'business'])` Fastify preHandler. Apply to `/api/v1/reports/*`, `/api/v1/devices/*`, and the `/sync` WebSocket. On reject:
  - REST → 402 `{ error: 'tier_required' }`.
  - WS    → close with `code: 'tier_required'` (the @counter/sync error message already supports it).
- Mobile: `useSyncStatus` already has a `'disabled'` status; on `tier_required` close the SyncClient should set status='disabled' (already does — see `client.ts` line ~165). Surface a toast in the mobile chrome.
- Web: add a route-group middleware in `app/(dashboard)/layout.tsx` that fetches the active org and redirects free orgs to `/pricing` (currently 404 — also create the placeholder page).
- Add `/api/v1/devices` (list + revoke) here since registers page (M7) is currently using a graceful empty-state fallback.

Open question to flag in the commit: HANDOFF §3 says **Free tier requires no account**; mobile must not gate sign-up behind Clerk. That conflict is already noted in `CLAUDE.md` and `master-w2-w8.md` §6 — but this is the commit where it becomes load-bearing. Default to allowing mobile to operate without Clerk by guarding the sync client, not the app boot. Mark with `TODO(open-question)`.

### M13 — `feat(admin): CSV import / export`

- API:
  - `POST /api/v1/imports/products` — accepts a CSV body (use `csv-parse@^5`), validates row by row, inserts inside a transaction. Returns a job-style `{ inserted, skipped, errors }` summary. (Streaming + signed URL upload is a later step — for now in-memory.)
  - `POST /api/v1/exports` — accepts `{ entity: 'products' | 'customers' | 'orders', format: 'csv' | 'json', dateRange? }`, returns a signed URL. For local dev, write to `/tmp/counter-exports/{uuid}.csv` and return `file://`.
- Web: `/dashboard/products` gets an Import button and a file picker; `/dashboard/customers` and `/dashboard/orders` (when it lands) get Export buttons.
- Use `csv-stringify@^6` for emit. CSV templates for Square / Shopify per HANDOFF §3 mobile screen 12 — keep the headers compatible.

### M14 — `test(e2e): master smoke + manual test plan`

CI already runs lint + typecheck + build + fixture-verification + API smoke. Add:

- API integration test (in `apps/api/test/integration.test.ts`) that exercises:
  - `auth/sync` upserts a user.
  - `POST /api/v1/orgs` creates an org with `region=US`.
  - `POST /api/v1/products` with two variants.
  - `POST /api/v1/customers`.
  - The above all succeed with valid Clerk tokens — use a stub verifier or hit a Clerk test token. Easier path: bypass the verifier in `NODE_ENV=test` with a `TEST_BEARER` env that maps directly to a synthetic `auth` object.
- Manual test plan in `docs/manual-test-plan.md` covering the offline mobile-sale → reconnect → web-visible flow that requires real devices (this is the W3 acceptance test from HANDOFF §4).
- Add the integration test to CI.
- Mark master Blueprint as **completed** in its frontmatter.

After M14:
- Update `README.md` "Status" section to "W2–W8 master push landed" with a link to manual-test-plan.
- Update `docs/blueprints/master-w2-w8.md` with the completion date.
- Optionally close out `docs/RESUME.md` (this file) by replacing its body with a one-liner: "Counter POS W2–W8 push completed. Next session resumes from a fresh plan."

---

## Known landmines / decisions captured along the way

These are surprises that bit me during the W2–W8 push. Carrying them forward saves the next session re-deriving them.

1. **drizzle-kit 0.20.x has pre-unified `generate:pg` commands.** We bumped `drizzle-orm` 0.30.10 → 0.33.0 and `drizzle-kit` to 0.24.2 to get the `generate` / `migrate` unified syntax. Don't downgrade.
2. **Bigint defaults break drizzle-kit 0.24's snapshot serializer** — use `sql\`0\`` instead of `0n` on `version` columns. (See any of the schema files.)
3. **Drizzle 0.33's `db.transaction` callback parameter loses generic info** when the schema is built via spread of multiple modules in `packages/schema/src/db.ts`. Worked around with explicit `(tx: typeof db) => ...`. Safe to keep; revisit when bumping drizzle.
4. **Schema package uses `moduleResolution: 'Bundler'`** and dropped `.js` suffixes on intra-package imports. drizzle-kit's esbuild loader couldn't follow `./auth.js` paths. Don't add the `.js` back.
5. **Clerk publishable-key placeholders must base64-decode to `<host>$`.** CI uses `pk_test_ZGV2LXNpdGUuY2xlcmsuYWNjb3VudHMuZGV2JA` — a synthetic key that decodes to `dev-site.clerk.accounts.dev$`. Older "pk_test_placeholder" strings break the Next build.
6. **`apps/web/.eslintrc.cjs` does not extend `next/core-web-vitals`** — it conflicts with `@counter/eslint-config`'s import plugin. We use plain `eslint app middleware.ts --max-warnings=0` instead of `next lint`.
7. **Root `.eslintrc.cjs` ignorePatterns are anchored with leading `/`** so the workspace `apps/*/src/` directories don't get accidentally ignored alongside the design-prototype root `src/`.
8. **Mobile uses an in-memory `sync_queue` stub** — not real WatermelonDB. Real durable persistence requires Watermelon model classes which are gated on a real device runtime test. Marked `TODO(M6 follow-up)` in `apps/mobile/src/sync/queue.ts`.
9. **Engine warnings about Node 25 vs Node 20 LTS** are noise. The CI workflow pins 20.12.2; locally the `>=20.12.0 <21` engine constraint warns but doesn't block (`.npmrc` has `engine-strict=false`).
10. **Mobile doesn't actually run on a device in this push.** All "ship" verification is at the typecheck / lint / build level. Out-of-Scope per master Blueprint §10. The 14-step DoD explicitly accepts this.

---

## Quick orient checklist for the next agent

When you pick this up:

1. `git status` — confirm M10 is the only outstanding work.
2. `git log --oneline | head -25` — sanity-check the commit graph matches this file.
3. Open `docs/blueprints/master-w2-w8.md` and re-read §8 (order of operations). M11–M14 still match.
4. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm build` to baseline the workspace.
5. Finish M10 (instructions above), then proceed M11 → M14 in order.
6. Each commit is signed (`-s -S`), Conventional Commits prefix, no Co-Authored-By trailer.
7. After M14, update README + master Blueprint as noted.

The user is in **auto mode** — execute autonomously, only pause for genuinely destructive actions or HANDOFF §9 policy questions that aren't already defaulted in the Blueprint.
