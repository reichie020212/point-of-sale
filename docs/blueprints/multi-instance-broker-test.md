# Blueprint: Multi-instance broker integration test

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode)
**Context**: HANDOFF §4 (Sync Engine) & §5 (Backend — Redis pub/sub fan-out)

## 1. Goal

Prove the `RedisBroker` actually fans out across separately-constructed
broker instances. The existing `pubsub.test.ts` only exercises a
single broker round-trip; that's enough to validate the `Broker`
interface but says nothing about the wire shape between two API
replicas. After this Blueprint, CI fails if a regression breaks the
cross-process publish/subscribe wiring of `apps/api/src/sync/pubsub.ts`.

## 2. Why this next?

- **Closes the last unverified risk in the sync engine.** Counter is
  designed to scale horizontally — multiple Fastify instances behind
  a load balancer, all talking to one Redis. The whole "live update
  arrives on phone B in <500ms" promise depends on the broker
  fanning across processes. Today we trust that by inspection. A
  regression in `RedisBroker.subscribe()` or `RedisBroker.publish()`
  would only surface when the second replica is added to a real
  deploy.
- **Smallest valuable scope left.** No schema, no UI, no native
  modules — one new test file plus a CI services-stanza addition.
- **Mirrors the existing skip pattern.** Tests that need
  `DATABASE_URL` self-skip when Postgres is unreachable; this one
  does the same for `REDIS_URL`. Contributors without a local
  Redis stay green.

## 3. Implementation Strategy

- **Two separately-constructed brokers in the same process.** Each
  `createBroker(REDIS_URL)` call produces its own `ioredis`
  publisher+subscriber pair. Within one Node process, two such
  brokers share *only* Redis — no in-memory state, no
  EventEmitter, no listener map. That's the same wire surface as
  two API replicas running on different hosts. If the test passes,
  the production fan-out is wired correctly; if someone replaces
  `createBroker` with an always-InProcess implementation, the
  first sub-test fails immediately because two InProcess brokers
  don't share an emitter.
- **Subscribe on broker B, publish on broker A.** Drives the
  publisher/subscriber asymmetry in the same direction production
  uses (one replica writes, the others read).
- **Three sub-tests.** Happy-path delivery; org isolation across
  instances; unsubscribe stops further deliveries on B even when
  publishes continue on A.
- **`waitFor` poll instead of fixed sleep.** Redis fan-out is
  millisecond-scale but variable; a 1s deadline with 20ms poll keeps
  the test fast on a healthy box and tolerant of CI jitter.

## 4. Execution Steps (Single Commit: `test(api): cross-instance broker fan-out + redis CI service`)

### Step 1 — CI Redis service
`.github/workflows/ci.yml` — add a `redis:7` service to the verify
job (mirroring the existing Postgres service stanza), and set
`REDIS_URL: redis://localhost:6379` in the job env. Reused across
`pnpm test`; no other test changes needed because the rest of the
suite ignores REDIS_URL today.

### Step 2 — New test file
`apps/api/test/broker-multi-instance.test.ts` — `redisReachable()`
helper opens a probe `Redis(REDIS_URL, { lazyConnect, maxRetries:1,
connectTimeout:1500, enableOfflineQueue:false })` and pings; auto-skips
if it can't connect. The test body builds two `Broker`s via
`createBroker(REDIS_URL)`, subscribes both target orgs on broker B,
and runs three sub-tests against broker A's publish path.

### Step 3 — Verify locally
- `docker run -d --rm --name redis-counter-test -p 6379:6379 redis:7`
- `REDIS_URL=redis://localhost:6379 pnpm --filter @counter/api test`
  → 15 pass / 0 fail / 4 DB-dependent skipped. The new test reports:
  ```
  ▶ cross-instance broker
    ✔ publish on A reaches subscriber on B
    ✔ cross-instance fan-out preserves org isolation
    ✔ unsubscribe on B stops further deliveries from A
  ```
- `pnpm --filter @counter/api lint && typecheck` clean.
- `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`
  validates the YAML.

## 5. Definition of Done

- [x] CI workflow provisions a `redis:7` service container with a
      passing `redis-cli ping` healthcheck.
- [x] `REDIS_URL` is exported to the verify job env.
- [x] New test creates two `Broker` instances and asserts cross-instance
      delivery + isolation + unsubscribe.
- [x] Test auto-skips when `REDIS_URL` is unreachable so contributors
      without a local Redis stay green.
- [x] All API tests pass locally against real Redis; lint + typecheck
      clean.

## 6. Open questions resolved at execution time

- **Why not boot two `buildServer()` instances and exercise the WS
  layer?** That would add ~150 lines of WS-client + auth scaffolding
  to test what is fundamentally one `RedisBroker` invariant. The two
  separately-constructed brokers in the same process are already a
  faithful proxy for two replicas on the wire (they share nothing
  but Redis). When the next surface needs WS-specific assertions,
  we'll lift this test up; for now the broker layer is the right
  unit.
- **Why not assert latency under 500ms?** Latency targets belong in
  manual-test-plan and observability dashboards, not unit tests —
  CI runners are too noisy to give a stable signal. The test still
  enforces a 1s upper bound via `waitFor`, which is generous but
  catches a complete failure to deliver.
- **Multi-instance prune coordination?** Out of scope. The
  maintenance worker (Blueprint #9) runs on every replica and the
  delete is idempotent; coordinating with a leader-election lock
  adds complexity disproportionate to the savings until the fleet
  has hundreds of pods.
- **Cleanup between tests?** The test creates org IDs scoped to
  `Date.now()` so back-to-back runs don't collide on the Redis
  channel name. No cleanup is necessary because Redis pub/sub does
  not retain messages after delivery.
