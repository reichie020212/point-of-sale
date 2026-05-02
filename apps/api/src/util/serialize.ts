/**
 * Wire-shape conversion for sync engine PULL responses.
 *
 * Drizzle returns rows keyed by JS property names (camelCase, e.g.
 * `orgId`, `priceCents`). The mobile client's `applyServerChanges`
 * has a snake_case column allowlist (`org_id`, `price_cents`) that
 * mirrors WatermelonDB's underlying SQLite schema. Without this
 * conversion, cross-device PULL would silently drop every column
 * except `id` and `deleted_at` because the allowlist filter rejects
 * unknown keys — the symptom is "row appears on device B but every
 * field is null".
 *
 * Conversion is shallow: only top-level keys are renamed. JSONB
 * values like `modifiers_json` are passed through untouched (the
 * mobile coerce layer treats them as opaque strings/objects).
 *
 * BigInt and Date values get JSON-friendly string forms — bigint as
 * decimal string (matches the wire `VersionString`), Date as ISO.
 */

/**
 * Convert a JS identifier to snake_case. Idempotent for already-
 * snake-case input; preserves digits.
 */
export function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function serializeRow(row: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    const key = toSnakeCase(k);
    if (typeof v === 'bigint') out[key] = v.toString(10);
    else if (v instanceof Date) out[key] = v.toISOString();
    else out[key] = v;
  }
  return out;
}
