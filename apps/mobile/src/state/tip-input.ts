/**
 * Pure helpers for the cart's tip-entry modal — no RN runtime imports
 * so they can be unit-tested under plain Node.
 *
 * §9 policy: fixed-amount entry only. No percent presets.
 */

/**
 * Parse a user-typed tip into integer cents. Accepts an optional
 * leading currency symbol (₱, $, €, £, ¥), thousand separators, and
 * up to two decimal places. Returns null when the input is empty or
 * unparseable so the caller can disable the submit affordance instead
 * of charging zero by accident.
 *
 * Examples (PHP):
 *   ''        → null
 *   '  '      → null
 *   '50'      → 5000
 *   '50.5'    → 5050
 *   '12.50'   → 1250
 *   '₱1,234.5' → 123450
 *   '-1'      → null  (refunds aren't tips)
 *   '1.234'   → null  (more than 2 decimals)
 *   'abc'     → null
 */
export function parseTipInputCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Strip a single leading currency symbol then any thousand separators.
  // Keep digits, a single dot, and a leading minus for the validator below
  // (we reject negatives explicitly).
  const stripped = trimmed.replace(/^[₱$€£¥]\s*/, '').replaceAll(',', '');
  if (!/^\d+(\.\d{1,2})?$/.test(stripped)) return null;

  const cents = Math.round(Number(stripped) * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents;
}
