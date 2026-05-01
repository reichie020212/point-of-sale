import type { Config } from 'tailwindcss';

/**
 * Tailwind theme is derived from @counter/tokens via CSS variables (see
 * `app/globals.css`). The theme below maps Tailwind's color/font/etc. names
 * to those variables so utilities like `bg-surface`, `text-ink`, and
 * `font-mono` resolve to tokenized values rather than hard-coded ones.
 *
 * Hard-coded color literals here would defeat the purpose — the no-restricted-syntax
 * lint rule allows this file because it lives outside `apps/**` source scope.
 */
const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        ink: 'var(--color-ink)',
        'ink-2': 'var(--color-ink-2)',
        'ink-3': 'var(--color-ink-3)',
        line: 'var(--color-line)',
        'line-2': 'var(--color-line-2)',
        accent: 'var(--color-accent)',
        'accent-deep': 'var(--color-accent-deep)',
        'accent-soft': 'var(--color-accent-soft)',
        ok: 'var(--color-ok)',
        warn: 'var(--color-warn)',
        bad: 'var(--color-bad)',
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        '4xl': 'var(--radius-4xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lifted: 'var(--shadow-lifted)',
        hero: 'var(--shadow-hero)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
