/**
 * Pure helpers for the `useOrgSettings` slice — no RN runtime imports
 * so they can be unit-tested under plain Node.
 */

export interface OrgSettings {
  /** Tax rate as a fraction (0.12 for 12% VAT). */
  taxRate: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** IANA timezone, used by future receipt headers. */
  timezone: string;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  taxRate: 0.12,
  currency: 'PHP',
  timezone: 'UTC',
};

/**
 * Server stores `tax_rate` as `numeric(5,3)` and emits a string like
 * `'12.000'` (percent). Cart math wants a fraction (0.12), so divide
 * by 100. Bad input → 0 (no tax) so we never multiply by NaN.
 */
export function parseTaxRate(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 100;
}

/**
 * Derive the next `OrgSettings` from a snake_case organizations
 * record (the wire shape of a sync EVENT payload). Fields the record
 * omits fall back to `current` so a partial PATCH (e.g. only
 * timezone) doesn't blank out tax rate or currency.
 */
export function recordToSettings(
  record: Record<string, unknown>,
  current: OrgSettings,
): OrgSettings {
  return {
    taxRate:
      typeof record.tax_rate === 'string' ? parseTaxRate(record.tax_rate) : current.taxRate,
    currency: typeof record.currency === 'string' ? record.currency : current.currency,
    timezone: typeof record.timezone === 'string' ? record.timezone : current.timezone,
  };
}
