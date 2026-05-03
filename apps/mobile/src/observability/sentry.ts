/**
 * Sentry init for the mobile register.
 *
 * Sentry RN v6 gracefully degrades when the native module isn't
 * present (i.e. running under `expo export` without a full EAS
 * dev-build). JS-level errors still get captured via the global
 * error handler; native crashes (Java / Obj-C) require an EAS
 * dev-client build, which lands in Phase C.
 *
 * The init is a no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset so the
 * existing `pnpm dev` and `expo export` pipelines stay green for
 * contributors without a Sentry sandbox. We deliberately don't
 * gate Sentry on the org-level telemetry toggle — error reports
 * are PII-scrubbed at the boundary and operational debugging
 * shouldn't be at the mercy of a per-org preference. The settings
 * UI text says so explicitly.
 */
import * as Sentry from '@sentry/react-native';

import { scrubSentryEvent } from './scrub';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  // EXPO_PUBLIC_* env vars are inlined at build time by Babel, which
  // is the modern Expo pattern. The DSN can also live in app.json
  // under `extra`, but we only support the env-var path for v1 to
  // keep the surface tight.
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  initialized = true;
  try {
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? __DEV__ ? 'development' : 'production',
      // Phase B is JS-level only; Phase C re-enables tracesSampler
      // once the EAS build pipeline lands and native instrumentation
      // is verified.
      tracesSampleRate: 1.0,
      sendDefaultPii: false,
      beforeSend(event) {
        return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
      },
    });
  } catch (err) {
    // Defense-in-depth: if Sentry init throws (e.g. native module
    // mismatch on a stale dev client), we log + swallow so the app
    // keeps booting. The cashier never sees a crash because
    // observability isn't available.
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed; observability disabled', err);
  }
}

export { Sentry };
