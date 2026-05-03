/**
 * Sentry init for the Next.js Edge runtime.
 *
 * Middleware (Clerk) runs here. The DSN reuses the server var — no
 * separate edge env is required.
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
