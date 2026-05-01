/**
 * Web platform export — flat objects ready for Tailwind config consumption
 * and the CSS-variable map that mirrors `variables.css`.
 *
 * Tailwind: extend the theme with `colors: webTheme.colors` etc.
 * Plain CSS: `@import '@counter/tokens/variables.css'` and use `var(--bg)`.
 */
import { colors, resolveColor, type ColorToken } from '../colors.js';
import { radii } from '../radii.js';
import { shadows } from '../shadows.js';
import { spacing } from '../spacing.js';
import { fontFamilies, fontWeights, moneyFont } from '../typography.js';

const colorEntries = Object.keys(colors) as ColorToken[];

const colorVarMap = Object.fromEntries(
  colorEntries.map((token) => [token, `var(--color-${kebab(token)}, ${resolveColor(token)})`]),
) as Record<ColorToken, string>;

export const webTheme = {
  colors: colorVarMap,
  fontFamilies,
  fontWeights,
  moneyFont,
  spacing,
  radii,
  shadows,
} as const;

export type WebTheme = typeof webTheme;

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
