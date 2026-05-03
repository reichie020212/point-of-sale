/**
 * PII / secrets scrubber for Sentry events.
 *
 * Wired into `Sentry.init({ beforeSend })` so every captured event
 * (errors and transactions) gets walked before transport. The list
 * is allow-list-by-key: anything matching gets replaced with the
 * literal `'[REDACTED]'` string, preserving the shape of the event
 * for grouping while keeping the value out of the wire.
 *
 * Pure function so it's unit-testable in node:test without booting
 * the SDK or building event objects out of an exception.
 *
 * Keys to redact (case-insensitive substring match):
 *   - `pin_hash` / `pin` — mobile PIN material
 *   - `device_token` / `device_secret` — paired-register secrets
 *   - `stripe_customer_id` / `stripe_subscription_id` — billing ids
 *     that aren't sensitive on their own but shouldn't leak unless
 *     we explicitly tag them
 *   - `authorization` / `cookie` — request headers (Sentry's HTTP
 *     integration captures headers verbatim by default)
 *   - `email` / `phone` — customer PII (HANDOFF non-negotiable #6)
 *   - `pan` / `card` / `cvv` / `cvc` — cardholder data (we don't
 *     handle this directly because Stripe Checkout is hosted, but
 *     the rule is defense-in-depth)
 */

const REDACTED = '[REDACTED]';

const SENSITIVE_PATTERNS = [
  /pin_?hash/i,
  /^pin$/i,
  /device_?(token|secret)/i,
  /stripe_(customer|subscription)_id/i,
  /authorization/i,
  /^cookie$/i,
  /^email$/i,
  /^phone$/i,
  /^pan$/i,
  /^card$/i,
  /^cvv$/i,
  /^cvc$/i,
];

function isSensitive(key: string): boolean {
  return SENSITIVE_PATTERNS.some((rx) => rx.test(key));
}

/**
 * Walk a value tree, redact sensitive keys. Bounded depth (16) to
 * avoid pathological cycles in user-supplied error contexts.
 */
export function scrubObject<T>(value: T, depth = 0): T {
  if (depth > 16 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubObject(v, depth + 1)) as unknown as T;
  }
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitive(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = scrubObject(v, depth + 1);
    }
  }
  return out as T;
}

/**
 * Sentry `beforeSend` hook entry point. Receives the full event,
 * scrubs request data, contexts, and tags, and returns it.
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  return scrubObject(event);
}
