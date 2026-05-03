/**
 * Funnel-event helpers for the mobile cashier path.
 *
 * Wraps `captureEvent` from `./posthog` with two thin policies:
 *   - `trackOnce(key, event, props)` fires the event only the first
 *     time it ever happens on this device (persisted via SecureStore
 *     so an app reinstall resets it but a process restart doesn't).
 *     Used for milestone events like `first_sale` that should fire
 *     exactly once per register.
 *   - `track(event, props)` is a thin pass-through to `captureEvent`
 *     for events that fire every time.
 *
 * Why SecureStore rather than the device row? `device_paired` ships
 * before any sync state exists, and we want milestone tracking to be
 * resilient to org-row migrations. Local boolean flags are the
 * simplest correct shape.
 */
import * as SecureStore from 'expo-secure-store';

import { captureEvent } from './posthog';

const KEY_PREFIX = 'counter.funnel.';

export function track(event: string, properties: Record<string, unknown> = {}): void {
  captureEvent(event, properties);
}

export async function trackOnce(
  key: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const storageKey = `${KEY_PREFIX}${key}`;
  try {
    const seen = await SecureStore.getItemAsync(storageKey);
    if (seen) return;
    captureEvent(event, properties);
    await SecureStore.setItemAsync(storageKey, '1');
  } catch {
    // SecureStore failures shouldn't block the cart — telemetry is
    // best-effort. Worst case: the milestone event fires more than
    // once, which is recoverable in PostHog.
  }
}
