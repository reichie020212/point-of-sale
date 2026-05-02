# Blueprint: CI mobile bundle verification + artifacting

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode)
**Context**: HANDOFF §2 (Mobile App) & §6 (Monorepo Layout)

## 1. Goal

Make the mobile bundle a first-class CI verification step. Every PR
to `main` produces an Android `expo export` bundle, and that bundle
is uploaded as a GitHub Actions artifact so reviewers can inspect
size and asset deltas without checking out the branch.

## 2. Why this next?

- **Insurance against bundler drift.** Two recent Blueprints (#10
  brand fonts, #11 expo-camera) touched native deps. Today's CI
  *does* run `expo export` (because turbo invokes the mobile
  workspace's `build` script), but the script defaults to all
  platforms — wasting Linux runner time on the iOS bundle and
  silently producing a web bundle nothing consumes. Pinning to
  `--platform android` makes the CI signal cheaper and the failure
  surface narrower.
- **Reviewer ergonomics.** Without an artifact, a bundle-size
  regression is invisible until somebody EAS-builds and notices
  the APK grew. Uploading `apps/mobile/dist` as a 7-day artifact
  lets reviewers diff the metadata.json + hbc against the previous
  PR's artifact.
- **Smallest item left in the backlog.** The remaining open work is
  Stripe billing, observability, multi-instance broker, native
  printer, and Stripe Terminal — most of those are medium-large
  surfaces that touch product policy or native modules. CI insurance
  is the cheapest unblocker before we touch any of them.

## 3. Implementation Strategy

- **Pin the mobile build to Android.** Change the mobile workspace's
  `build` script from `expo export` (all platforms) to `expo export
  --platform android`. Linux CI doesn't compile native code anyway,
  so iOS gets nothing extra from being bundled there, and our web
  surface lives in `apps/web` — Expo's web bundler is unused.
- **Reuse the existing `pnpm build` step.** Turbo invokes mobile's
  `build` as part of `pnpm build`. Adding a separate explicit step
  would duplicate work because turbo can't cache `--platform android`
  through the all-platforms invocation. So the existing "Build all"
  step now produces an Android-only bundle.
- **Upload the artifact.** A new `actions/upload-artifact@v4` step
  with `if: always()` runs after "Build all" so the bundle is
  attached to the run regardless of later test failures. Retention
  is 7 days — enough for a typical PR review window without
  ballooning storage. `if-no-files-found: warn` keeps the build
  green if `expo export` ever fails before producing dist (the
  preceding `pnpm build` step has already failed by that point,
  so the warning is informational).

## 4. Execution Steps (Single Commit: `ci(mobile): pin export to android + upload bundle artifact`)

### Step 1 — Pin mobile build to Android
`apps/mobile/package.json` — `"build": "expo export --platform
android"`. Local dev (`pnpm --filter @counter/mobile build`) and CI
both produce the single Android bundle. iOS exports happen in EAS
once a release branch lands; the JS-only `expo export` doesn't add
signal there.

### Step 2 — Add the upload step
`.github/workflows/ci.yml` — between "Build all" and "Apply database
migrations":

```yaml
- name: Upload mobile bundle (Android)
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: mobile-bundle-android
    path: apps/mobile/dist
    if-no-files-found: warn
    retention-days: 7
```

### Step 3 — Verify locally
`pnpm --filter @counter/mobile clean && pnpm build` — turbo runs the
mobile build, produces `apps/mobile/dist/_expo/static/js/android/
index-*.hbc` plus the asset manifest, no `ios/` or web folders.
`metadata.json` shows the single android entry with all bundled ttfs.

`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/
ci.yml'))"` validates the workflow YAML.

## 5. Definition of Done

- [x] Mobile workspace builds only Android by default; iOS/web no
      longer wasted CI time.
- [x] `pnpm build` produces a single `_expo/static/js/android/`
      output directory.
- [x] CI workflow uploads `apps/mobile/dist` as
      `mobile-bundle-android` artifact, 7-day retention.
- [x] Artifact upload runs even when subsequent tests fail
      (`if: always()`).
- [x] Workflow YAML parses; `pnpm build` clean locally.

## 6. Open questions resolved at execution time

- **iOS in CI?** Skipped. EAS handles iOS bundling once a release
  branch is cut; running `expo export --platform ios` on Linux
  doesn't compile native code, so the only thing it would catch is
  a Metro/transformer regression — and the Android export already
  shares 99% of that pipeline with iOS. The 1% iOS-specific (e.g.
  `ios/Podfile` resolution) requires a macOS runner, which is 10×
  the cost.
- **Bundle-size gating.** Skipped for now. We don't have a baseline
  to compare against. A future Blueprint could add a CI check that
  diffs the hbc size against the previous main commit and fails if
  it grew >10%; landing it before we have a baseline would be
  premature.
- **Web bundle artifact.** Skipped. `apps/web/.next` is huge and
  doesn't help reviewers; Vercel/Cloudflare deploy preview is the
  right place for web bundle review (we'll wire that later).
- **Caching `apps/mobile/dist`.** turbo already caches the build
  output across runs. The artifact is a side effect, not a cache —
  GitHub's artifact storage isn't a turbo remote.
