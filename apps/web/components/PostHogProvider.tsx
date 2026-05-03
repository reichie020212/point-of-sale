'use client';

/**
 * PostHog provider — initializes the analytics SDK once on first
 * mount and identifies the cardholder when Clerk emits a session.
 *
 * No-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset (CI / fresh dev),
 * so feature code can call `posthog.capture('event')` everywhere
 * without conditionals.
 *
 * Funnel events we expect to track from the marketing + dashboard
 * surface (Phase A naming):
 *   - `pricing_viewed`        (marketing /pricing pageview)
 *   - `signup_completed`      (Clerk signup success)
 *   - `onboarding_completed`  (org created, region picked)
 *   - `checkout_started`      (form submitted on /pricing)
 *   - `subscription_activated` (webhook flips tier; logged from
 *     /dashboard/billing on first paint after a `?status=success`)
 */
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { useEffect } from 'react';

import { scrubObject } from '../lib/scrub';

import type { ReactNode } from 'react';

let initialized = false;

function initOnce() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  initialized = true;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false,
    // PostHog `properties` is the user-supplied bag — scrub before
    // dispatch so $set / $set_once payloads can't leak emails / pins.
    sanitize_properties: (properties) => scrubObject(properties),
  });
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    initOnce();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (isSignedIn && user) {
      // We deliberately don't push the email — Clerk userId is
      // enough for cross-device identity, and emails would route
      // through the scrubber anyway. Tag with org id (if known) for
      // funnel segmentation; the org-level info comes from a
      // server-side `posthog.capture` once the funnel grows there.
      posthog.identify(user.id, {});
    } else if (!isSignedIn) {
      posthog.reset();
    }
  }, [isSignedIn, user]);

  return <>{children}</>;
}
