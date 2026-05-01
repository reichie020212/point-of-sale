/**
 * Passing fixture for the no-restricted-syntax color rule.
 * Imports tokens from @counter/tokens — no hard-coded color literals.
 *
 * `pnpm lint` against this file MUST exit 0.
 */
import { colors, resolveColor } from '@counter/tokens';

export const buttonStyles = {
  background: colors.surface.hex,
  color: colors.ink.hex,
  borderColor: resolveColor('line2'),
  accent: resolveColor('accent', 'oklch'),
};
