/**
 * Sentry init for the Counter API.
 *
 * Calls `Sentry.init` once, idempotently, before Fastify boots so the
 * SDK's auto-instrumentation can hook into HTTP / Postgres / Redis
 * spans. When `SENTRY_DSN` is unset (dev / CI / fresh clones) the
 * call is a no-op — the SDK still loads but never transports events,
 * so the rest of the codebase can use `Sentry.captureException(err)`
 * without conditionals.
 *
 * Source map upload + release tagging happens at deploy time via the
 * Sentry CLI (Phase B); the runtime side just consumes
 * `SENTRY_RELEASE` from env if it's set.
 */
import * as Sentry from '@sentry/node';

import { scrubSentryEvent } from './scrub.js';

import type { Config } from '../config.js';

let initialized = false;

export function initSentry(config: Config): void {
  if (initialized) return;
  initialized = true;
  Sentry.init({
    dsn: config.SENTRY_DSN,
    release: config.SENTRY_RELEASE,
    environment: config.SENTRY_ENVIRONMENT ?? config.NODE_ENV,
    tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    // Don't auto-capture user PII from request data; we add user
    // context (org id, user id) explicitly elsewhere.
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
    beforeSendTransaction(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
  });
}

export { Sentry };
