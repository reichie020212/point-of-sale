/**
 * Sentry Node SDK init for the Next.js server runtime.
 *
 * Captures errors from server components, route handlers, and server
 * actions. DSN comes from server-only env (no NEXT_PUBLIC_ prefix)
 * so it's never bundled to the client.
 */
import * as Sentry from '@sentry/nextjs';

import { scrubSentryEvent } from './lib/scrub';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
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
