# Blueprint: Web e2e Playwright happy path

**Status**: Completed — landed 2026-05-03
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-03 (auto mode)
**Context**: HANDOFF §3 (Web Dashboard) & §7 (Build Order)

## 1. Goal

Add automated browser-level coverage for the public marketing →
pricing → sign-up funnel so regressions in the unauthenticated
acquisition path stop being invisible.

## 2. Why this next?

- **Smallest valuable scope left.** No schema, no native deps, no
  third-party policy. A single Chromium spec against the routes that
  every prospect actually walks.
- **Closes a manual-test-plan gap.** §1 of the manual test plan asks
  someone to load `/`, click into `/pricing`, confirm the tiers
  render, click "Get started", land on `/sign-up`. Today nothing
  catches a regression in that path until somebody opens a browser.
- **Insurance for the next two big Blueprints.** Stripe billing on
  `/pricing` and observability instrumentation are both about to
  touch this exact path. Having an e2e baseline now means those
  Blueprints get a fast feedback loop.
- **Surfaced an existing latent bug.** While running the spec
  locally, `clerkMiddleware` returned a Clerk JSON error for
  browser requests to `/` because the placeholder publishable key
  doesn't match a real Clerk instance and Clerk's host validation
  fires for requests with browser fetch metadata. Curl bypassed it;
  Playwright did not. Fix lands in the same commit.

## 3. Implementation Strategy

- **Chromium-only.** Multi-browser coverage isn't free in CI time
  and the funnel is identical across engines. Add Firefox/WebKit
  later if a regression turns out to be browser-specific.
- **Production build, not `next dev`.** `webServer` boots `pnpm
  start` against the already-compiled `apps/web/.next`. This catches
  bundle/env regressions that `next dev` would mask, and lets the
  CI step reuse the artifacts produced by the existing "Build all"
  step.
- **Reuse-existing-server locally.** `reuseExistingServer:
  !process.env.CI` so a developer running `pnpm dev` once can
  iterate on the spec without rebuilding. CI always cold-starts.
- **Stop at the `/sign-up` route mount.** Don't drive Clerk's hosted
  UI — it needs CI secrets and isn't the unit under test. Asserting
  the URL changes to `/sign-up` is enough signal for "the funnel's
  CTAs still link correctly." A future Blueprint will introduce a
  Clerk test-mode bypass when Stripe billing lands and we need real
  auth in tests.
- **Narrow Clerk middleware to protected routes.** The matcher was
  `'/((?!_next|.*\\..*).*)'` (everything). Narrowing it to
  `'/dashboard/:path*', '/onboarding/:path*'` skips Clerk on public
  routes entirely. Sign-in/up still work because their pages render
  Clerk components, which call Clerk's API client-side; they don't
  need server-side middleware on the request itself.

## 4. Execution Steps (Single Commit: `test(web): playwright e2e for marketing funnel + clerk matcher fix`)

### Step 1 — Devdep + scripts
`apps/web/package.json` — add `@playwright/test@1.48.2` to
`devDependencies`. New scripts: `e2e: "playwright test"` and
`e2e:install: "playwright install --with-deps chromium"` (CI calls
the install variant; local dev runs it once when needed).

### Step 2 — Playwright config
`apps/web/playwright.config.ts` — Chromium-only, single worker,
`webServer` boots `pnpm start` from the workspace cwd, retries=1
under CI, `trace: 'retain-on-failure'`, `screenshot:
'only-on-failure'`. `reuseExistingServer` is true off-CI.

### Step 3 — Funnel spec
`apps/web/e2e/marketing-funnel.spec.ts` —

1. `page.goto('/')`; assert h1 contains "calm point-of-sale";
   assert "Get started" link has `href="/sign-up"`.
2. `page.goto('/pricing')`; iterate the three tiers, check name,
   price text exact match, and the price element carries
   `font-mono` (the Blueprint #10 brand-font check).
3. Back to `/`, click "Get started", `waitForURL('**/sign-up')`,
   assert url matches `/sign-up`.

### Step 4 — Narrow Clerk matcher
`apps/web/middleware.ts` — `config.matcher` becomes
`['/dashboard/:path*', '/onboarding/:path*']`. Public marketing
and Clerk auth pages no longer pay the middleware-induced host
validation round-trip.

### Step 5 — Gitignore + CI
`.gitignore` — append `playwright-report/`, `test-results/`,
`playwright/.cache/`. `.github/workflows/ci.yml` — three new
steps after "Mobile unit tests": "Install Playwright Chromium"
(`pnpm --filter @counter/web e2e:install`), "Web e2e (Playwright)"
(`pnpm --filter @counter/web e2e`), "Upload Playwright report"
(`actions/upload-artifact@v4` with `if: failure()` and
`if-no-files-found: ignore` so green runs don't upload empty
artifacts).

### Step 6 — Verify locally
- `pnpm --filter @counter/web exec playwright install chromium`
- `pnpm --filter @counter/web build`
- `pnpm --filter @counter/web e2e` →
  `1 [chromium] › marketing-funnel.spec.ts › marketing funnel ›
  landing → pricing → sign-up CTA (787ms) ✓ — 1 passed (2.6s)`
- `pnpm --filter @counter/web lint && typecheck` clean.
- `python3 -c 'import yaml; yaml.safe_load(...)'` validates the
  workflow.

## 5. Definition of Done

- [x] `@playwright/test` is a workspace devdep; `e2e` and
      `e2e:install` scripts exist.
- [x] `playwright.config.ts` boots `next start` and runs Chromium-
      only with retain-on-failure traces.
- [x] Single happy-path spec passes locally and asserts hero,
      pricing tiers (with monospace prices), and sign-up
      navigation.
- [x] Clerk middleware no longer intercepts marketing routes.
- [x] CI installs Chromium, runs the spec, and uploads the report
      on failure as a 7-day artifact.
- [x] Lint, typecheck, web build, and e2e all green locally.

## 6. Open questions resolved at execution time

- **Clerk in e2e.** Deferred to a later Blueprint. Driving Clerk's
  hosted UI in CI requires either a real test instance with
  CLERK_E2E_USERNAME/PASSWORD secrets or a custom dev-mode bypass
  inside `<ClerkProvider>`. Both are mid-sized unblockers for
  Stripe-billing-on-pricing; folding them in there keeps the tests
  honest about the real auth shape.
- **Multiple browsers.** Chromium-only. The acquisition funnel has
  no JS-engine-specific behavior worth covering in three browsers.
  Worth revisiting if Sentry shows engine-specific errors.
- **Where the spec lives.** Top-level `apps/web/e2e/` rather than
  inside `apps/web/app/` so Next.js doesn't try to type or lint it
  as App Router source. The existing tsconfig matches the spec
  (`include: ["**/*.ts", "**/*.tsx"]`); the eslint script's scope
  (`eslint app middleware.ts`) deliberately excludes it because
  the @counter/eslint-config no-restricted-syntax rule would flag
  Playwright's test fixture imports as "non-tokenized".
- **Why not run the spec against `next dev`?** `next start` exposes
  the same code path as production deployment. The CI's existing
  `Build all` step already produced `.next/`; the e2e step just
  spins it up.
