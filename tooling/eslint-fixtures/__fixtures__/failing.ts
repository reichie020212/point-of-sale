/**
 * Failing fixture for the no-restricted-syntax color rule.
 *
 * Each color literal below MUST trip the lint rule. Run:
 *
 *   pnpm --filter @counter/eslint-config lint:fixtures:failing
 *
 * The script asserts the rule fires for every line in this file. If the
 * lint passes (no errors), the test fails — meaning the rule has been
 * weakened and the token discipline non-negotiable is no longer enforced.
 */
export const bad = {
  hex3: '#fff',
  hex6: '#FF00FF',
  hex8: '#FF00FF80',
  rgb: 'rgb(255, 0, 255)',
  rgba: 'rgba(255, 0, 255, 0.5)',
  hsl: 'hsl(300, 100%, 50%)',
  hsla: 'hsla(300, 100%, 50%, 0.5)',
  oklch: 'oklch(0.7 0.2 300)',
  oklab: 'oklab(0.7 0.1 -0.1)',
};
