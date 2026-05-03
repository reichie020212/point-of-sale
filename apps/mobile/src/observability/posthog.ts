/**
 * PostHog client for the mobile register.
 *
 * Identity is the *device* (paired register), not the cashier —
 * mobile auth is per-device, the cashier signs in with a 4-digit PIN
 * but doesn't carry a Clerk session. Funnel events fire whenever
 * the cashier completes a meaningful action: device_paired,
 * first_sale, refund_started, tip_added, pin_signin.
 *
 * Gated by the org-level `telemetryEnabled` flag (via
 * `useOrgSettings`). When the flag flips to false the SDK calls
 * `optOut()` and stops dispatching events; flipping back to true
 * resumes capture. Sentry is *not* gated by this flag — see the
 * note in `sentry.ts`.
 *
 * Init is a no-op when `EXPO_PUBLIC_POSTHOG_KEY` is unset.
 */
import PostHog from 'posthog-react-native';

import { scrubObject } from './scrub';

let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (client) return client;
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;
  client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    captureNativeAppLifecycleEvents: true,
  });
  return client;
}

/**
 * Apply the org-level telemetry preference. Default-on; when the
 * synced org row says `telemetryEnabled: false`, we opt out and
 * the SDK stops dispatching events.
 */
export function applyTelemetryPreference(enabled: boolean): void {
  const ph = getPostHog();
  if (!ph) return;
  if (enabled) ph.optIn();
  else ph.optOut();
}

/**
 * Identify the register by deviceId once it pairs. Skips when no
 * deviceId yet (a fresh app launch before pair) or when the SDK
 * isn't configured.
 */
export function identifyDevice(deviceId: string | null, orgId: string | null): void {
  const ph = getPostHog();
  if (!ph || !deviceId) return;
  ph.identify(deviceId, scrubObject({ orgId: orgId ?? undefined }));
}

/**
 * Capture a funnel event. Properties run through the scrubber so
 * any accidental PII inclusion (e.g. customer email on a sale) gets
 * redacted before transport.
 */
export function captureEvent(event: string, properties: Record<string, unknown> = {}): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture(event, scrubObject(properties));
}
