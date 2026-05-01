/**
 * Spacing scale — 4px base unit per HANDOFF §1. Numeric keys map to multiples
 * of the base unit (`spacing[2] === 8`, `spacing[6] === 24`).
 */
export const SPACING_UNIT = 4;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type SpacingToken = keyof typeof spacing;
