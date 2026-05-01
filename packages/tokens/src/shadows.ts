/**
 * Shadow tokens per HANDOFF §1.
 *
 * - card    — soft card resting state
 * - lifted  — sheets, popovers, dropdowns
 * - hero    — landing-page hero artwork
 */
export const shadows = {
  card: '0 1px 2px rgba(0, 0, 0, 0.04)',
  lifted: '0 24px 48px rgba(20, 15, 5, 0.15)',
  hero: '0 40px 80px rgba(20, 15, 5, 0.18)',
} as const;

export type ShadowToken = keyof typeof shadows;
