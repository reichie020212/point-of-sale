/**
 * Counter POS color tokens.
 *
 * OKLCH-first per HANDOFF §1. Hex fallbacks accompany every OKLCH value so
 * platforms without OKLCH support (older Android WebViews, RN as of late 2025)
 * still render correctly. Status colors stay hex because the prototype palette
 * was authored that way — convert to OKLCH if/when we re-tune them.
 *
 * Naming follows the CSS-variable names from HANDOFF §1 with `--` stripped.
 */
export const colors = {
  bg: { hex: '#F5F2EC', use: 'App canvas (warm off-white)' },
  surface: { hex: '#FFFFFF', use: 'Cards, sheets' },
  surface2: { hex: '#FBF8F2', use: 'Inset / hover surfaces' },

  ink: { hex: '#161615', use: 'Primary text, dark slabs' },
  ink2: { hex: '#4A4842', use: 'Body text' },
  ink3: { hex: '#8B887F', use: 'Secondary / captions' },

  line: { hex: 'rgba(0, 0, 0, 0.07)', use: 'Hairline dividers' },
  line2: { hex: 'rgba(0, 0, 0, 0.12)', use: 'Button borders' },
  scrim: { hex: 'rgba(0, 0, 0, 0.45)', use: 'Modal / bottom-sheet backdrop' },

  accent: {
    oklch: 'oklch(0.72 0.14 70)',
    hex: '#D4A842',
    use: 'Warm amber — CTAs, brand marks',
  },
  accentDeep: {
    oklch: 'oklch(0.55 0.16 70)',
    hex: '#9B7A28',
    use: 'Accent text on light bg',
  },
  accentSoft: {
    oklch: 'oklch(0.94 0.05 70)',
    hex: '#F1E5CB',
    use: 'Accent surface tint',
  },

  ok: { hex: '#4BA971', use: 'Paid / live / success' },
  warn: { hex: '#D4A842', use: 'Low stock' },
  bad: { hex: '#D84C3F', use: 'Refund / error / destructive' },
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Resolve a color token to a CSS-renderable string. On platforms with OKLCH
 * support, prefer the OKLCH form; on others, fall back to hex.
 */
export function resolveColor(token: ColorToken, prefer: 'oklch' | 'hex' = 'oklch'): string {
  const value = colors[token];
  if (prefer === 'oklch' && 'oklch' in value) return value.oklch;
  return value.hex;
}
