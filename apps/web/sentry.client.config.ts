/**
 * Sentry browser SDK init.
 *
 * Reads the DSN from `NEXT_PUBLIC_SENTRY_DSN` so the value is bundled
 * into the client. Without a DSN the SDK no-ops; production sets it
 * via Vercel env. Release tagging is handled by `@sentry/nextjs`'s
 * webpack plugin at build time when `SENTRY_AUTH_TOKEN` is set.
 */
import * as Sentry from '@sentry/nextjs';

import { scrubSentryEvent } from './lib/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
    beforeSendTransaction(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
  });
}
