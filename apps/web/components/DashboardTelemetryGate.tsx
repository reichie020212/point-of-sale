'use client';

/**
 * Reactive PostHog opt-in / opt-out gate for the dashboard.
 *
 * The root layout's `<PostHogProvider>` initializes PostHog
 * unconditionally so anonymous marketing-funnel tracking works
 * before sign-in. Once the user lands inside the dashboard, the
 * server component reads the active org's `telemetryEnabled` flag
 * and renders this gate to flip PostHog into / out of opt-out
 * mode. No-ops when PostHog isn't configured (key unset).
 */
import posthog from 'posthog-js';
import { useEffect } from 'react';

export function DashboardTelemetryGate({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    // posthog has noop methods when not initialized, so this is
    // safe to call regardless of `NEXT_PUBLIC_POSTHOG_KEY` state.
    if (enabled) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }, [enabled]);
  return null;
}
