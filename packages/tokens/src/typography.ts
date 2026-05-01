/**
 * Typography tokens — three font families with strict role assignments.
 *
 * From HANDOFF §1 / §8:
 *   - UI                    → Inter
 *   - Numerals & codes      → JetBrains Mono (every price; every timestamp; SKUs; pairing codes)
 *   - Display / hero        → Fraunces (italic accent words)
 *
 * Never mix roles. CLAUDE.md non-negotiable #3 enforces money-as-monospace.
 */
export const fontFamilies = {
  ui: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  display: "'Fraunces', Georgia, serif",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Use this token for any price, total, timestamp, SKU, or pairing code. */
export const moneyFont = {
  fontFamily: fontFamilies.mono,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;
export type FontWeightToken = keyof typeof fontWeights;
