# Blueprint: Observability & Beta Hardening (Week 8)

**Status**: Implemented (Phase A — API + Web)
**Context**: HANDOFF §7 (W8), §8 (Non-negotiables) & Blueprint #26
**Architect**: Gemini
**Executor**: Claude

## 0. Executor split (2026-05-03)

The proposed Blueprint covered all three surfaces in one commit. After
investigating risk, this commit lands **Phase A — API + Web** only;
mobile observability is split out to **Phase B**:

- **`@sentry/react-native`** needs native module linking through an
  Expo config plugin. The mobile CI build is `expo export --platform
  android` which produces only the JS bundle (hbc); native links
  aren't validated. A naive `Sentry.init` would *appear* to build
  green but crash on first run on a real device because the native
  side isn't there.
- **`posthog-react-native`** has the same kind of native dependency
  on `expo-device`. Same risk.
- Mobile is local-first: a JS crash on a register is recoverable
  (user reopens app); a server crash is catastrophic (everyone
  loses sync). API + Web are the higher-stakes surfaces, so they
  ship first.

**Phase B will land:** mobile Sentry init + ErrorBoundary, mobile
PostHog identify-on-pair, source map upload from EAS, expo config
plugin wiring. Tracked as a separate Blueprint after the user has an
EAS pipeline (currently unset).

The CI source-map upload step is also deferred (auth tokens not yet
provisioned). The runtime SDKs are wired so adding `SENTRY_AUTH_TOKEN`
+ `SENTRY_ORG` + `SENTRY_PROJECT` env vars unlocks uploads without
further code changes.

## 1. Goal
Harden the Counter platform for beta launch by implementing full-stack error tracking, product analytics, and enhanced system health monitoring with rigorous PII protection.

## 2. Why this next?
This is the "Insurance" phase. We have built the product; now we must ensure we can support it. Sentry provides the "eyes" into production crashes, while PostHog provides the "brain" for understanding where merchants drop off in the funnel. Landing this before the beta is non-negotiable for operational safety.

## 3. Implementation Strategy
- **Sentry**: Use official SDKs for Next.js, Fastify (Node), and React Native. Release tagging will use `process.env.GIT_SHA`. Sampling is 100% for the beta.
- **PostHog**: Client-side only for v1. Identity is bridged via Clerk `userId`. Events are "action-oriented" (e.g., `checkout_completed`, not `button_clicked`).
- **PII Protection**: Scrubbing is enforced at the SDK initialization level. `beforeSend` (Sentry) and `before_send` (PostHog) will redact common sensitive keys.
- **Health**: `/healthz` becomes a dependency check, returning `503 Service Unavailable` if the DB or Redis is unreachable.

## 4. Files touched (Phase A)

### Shared scrubber pattern
A pure `scrubObject(value)` helper lives once on each surface
(`apps/api/src/observability/scrub.ts` + `apps/web/lib/scrub.ts`),
keyed on a regex allow-list: `pin_hash` / `pin`, `device_token` /
`device_secret`, `stripe_customer_id` / `stripe_subscription_id`,
`authorization` / `cookie`, `email` / `phone`, `pan` / `card` /
`cvv` / `cvc`. Case-insensitive substring match; depth-bounded at
16 levels to survive cyclic structures. Wired into Sentry's
`beforeSend` and `beforeSendTransaction` hooks on every surface
+ PostHog's `sanitize_properties`.

### API (`apps/api/`)
- `package.json` — adds `@sentry/node@8.39.0`.
- `src/config.ts` — four optional env vars: `SENTRY_DSN`,
  `SENTRY_RELEASE`, `SENTRY_ENVIRONMENT`,
  `SENTRY_TRACES_SAMPLE_RATE` (defaults 1.0).
- `src/observability/scrub.ts` — pure scrubber.
- `src/observability/sentry.ts` — `initSentry(config)` lazy init;
  no-op when `SENTRY_DSN` is unset (so CI / fresh clones still
  boot). `sendDefaultPii: false`. Re-exports `Sentry` for use sites.
- `src/server.ts` — calls `initSentry(config)` before Fastify
  boots so auto-instrumentation can wrap http/postgres/redis
  spans. The Fastify error handler now forwards 5xx-class errors
  to `Sentry.captureException` with `route` + `method` tags;
  4xx-class errors stay out of the dashboard noise.
- `src/sync/pubsub.ts` — `Broker` interface gains a `ping(): Promise<void>`
  method; `InProcessBroker` no-ops, `RedisBroker` issues a `PING`.
- `src/routes/health.ts` — `/healthz` is unchanged liveness probe;
  `/readyz` upgraded to ping both Postgres and the broker, returns
  `503 { status: 'not_ready', checks: { db, broker } }` when
  either is down. Synthetic uptime monitors can now distinguish
  partial outages from full ones.
- `test/scrub.test.ts` — 11 cases covering redaction of every
  pattern, nested-object walking, array walking, primitive
  passthrough, depth-bounded cycle survival, case-insensitive
  matching.

### Web (`apps/web/`)
- `package.json` — adds `@sentry/nextjs@8.39.0`,
  `posthog-js@1.181.0`.
- `lib/scrub.ts` — pure scrubber (mirrors API; same regex list).
- `sentry.client.config.ts` / `sentry.server.config.ts` /
  `sentry.edge.config.ts` — three Next.js Sentry init files.
  Each reads its own DSN env var (`NEXT_PUBLIC_SENTRY_DSN` for
  the browser, `SENTRY_DSN` for server + edge), no-ops when
  unset, runs `scrubSentryEvent` in `beforeSend` /
  `beforeSendTransaction`.
- `next.config.mjs` — wrapped in `withSentryConfig` so
  `pnpm build` can upload source maps when `SENTRY_AUTH_TOKEN` +
  `SENTRY_ORG` + `SENTRY_PROJECT` are set; runtime no-op without
  the token.
- `components/PostHogProvider.tsx` — client component that
  initializes PostHog once and identifies the user when Clerk
  emits a session. `posthog.reset()` on sign-out. Only loads
  with `NEXT_PUBLIC_POSTHOG_KEY` set; otherwise the provider is
  a transparent passthrough. `sanitize_properties` runs the
  scrubber so $set / $set_once payloads can't leak emails / pins.
- `app/layout.tsx` — wraps `{children}` in `<PostHogProvider>`
  inside the Clerk provider.

### Env-var contract for Phase A
| Var | Where | Effect when unset |
|---|---|---|
| `SENTRY_DSN` | API server | SDK no-ops (still loaded) |
| `NEXT_PUBLIC_SENTRY_DSN` | Web client | SDK no-ops |
| `SENTRY_DSN` (server) | Web SSR + middleware | SDK no-ops |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | Build-time | Source maps not uploaded |
| `SENTRY_RELEASE` | All | Events untagged with release |
| `SENTRY_ENVIRONMENT` | All | Falls back to NODE_ENV |
| `NEXT_PUBLIC_POSTHOG_KEY` | Web client | Provider passthrough |
| `NEXT_PUBLIC_POSTHOG_HOST` | Web client | Defaults to https://us.i.posthog.com |

## 5. Verification (Phase A)
- `pnpm lint` — green across all 13 workspaces.
- `pnpm build` — green across all 8 workspaces; web first-load JS
  jumps 87 KB → 142 KB to absorb Sentry + PostHog clients
  (acceptable for a beta).
- `pnpm test` — API tests 41 → 52 (11 new scrubber cases), all
  pass; mobile 82 unchanged. DB integration tests still skip when
  DATABASE_URL is unreachable.
- Manual: `throw new Error('test')` from any 5xx-class path
  reaches Sentry once `SENTRY_DSN` is configured; the request body
  / cookie / authorization header all read `[REDACTED]` in the
  event payload.

## 6. Definition of Done (Phase A)
- [x] API Sentry init fires before Fastify; 5xx errors forwarded
      with route + method tags.
- [x] Web Sentry: client + server + edge configs wired; PII
      scrubber runs on every event.
- [x] `/readyz` checks DB **and** broker, returns per-dep status.
- [x] PostHog provider identifies Clerk users; `sanitize_properties`
      gates leaks.
- [x] Scrubber unit-tested across both surfaces; 11 API cases.
- [x] All env vars optional — CI + dev clones boot without DSNs.
- [x] Lint + build + test green.

## 7. Phase B (deferred)
- **Mobile Sentry** — `@sentry/react-native` + Expo config plugin,
  `Sentry.wrap()` at the root, `ErrorBoundary` to prevent the
  white-screen-of-death on JS crashes.
- **Mobile PostHog** — `posthog-react-native` with identify-on-pair;
  funnel events `device_paired` / `first_sale` / `tip_added` /
  `pin_signin`.
- **Source map upload in CI** — `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`
  + `SENTRY_PROJECT` injected; `pnpm build` already wired.
  Mobile EAS source-map upload via sentry-expo plugin.
- **Telemetry opt-out toggle** in `/dashboard/settings` — owner-
  controlled, default-on, per HANDOFF non-negotiable #6.
- **Server-side PostHog events** (`tier_flipped`, `webhook_received`,
  `export_run`) so the funnel is truth-in-database, not truth-in-client.
