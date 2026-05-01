/**
 * Corner-radius scale per HANDOFF §1: 4 / 6 / 8 / 10 / 12 / 14 / 18 / 24 / pill.
 */
export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 18,
  '4xl': 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;
