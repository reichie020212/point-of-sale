/**
 * PII / secrets scrubber for Sentry events on the web surface.
 *
 * Mirrors `apps/api/src/observability/scrub.ts` — kept in sync by
 * convention. Pure helper so it can be imported into both the
 * client and server Sentry configs without bundling concerns.
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

export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  return scrubObject(event);
}
