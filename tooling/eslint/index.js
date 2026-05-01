/**
 * Base ESLint config for Counter POS.
 *
 * Token discipline (HANDOFF §8 / CLAUDE.md):
 *   Hard-coded color literals are forbidden outside `packages/tokens`.
 *   This is enforced via `no-restricted-syntax` against string and template
 *   literals matching common color formats. The `tokens` package, fixture
 *   files, and design-prototype HTML/JSX (read-only references) are exempt
 *   via overrides in the consuming workspace's `.eslintrc`.
 *
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  root: false,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['tsconfig.json', 'packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
      },
      node: true,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'Literal[value=/(?:^|[^\\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
        message:
          'Hard-coded hex color literal. Import the token from @counter/tokens instead (CLAUDE.md non-negotiable #2).',
      },
      {
        selector: 'Literal[value=/\\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\\s*\\(/]',
        message:
          'Hard-coded color function literal. Import the token from @counter/tokens instead (CLAUDE.md non-negotiable #2).',
      },
      {
        selector:
          'TemplateElement[value.raw=/(?:^|[^\\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
        message:
          'Hard-coded hex color literal in template string. Import the token from @counter/tokens instead.',
      },
      {
        selector: 'TemplateElement[value.raw=/\\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\\s*\\(/]',
        message:
          'Hard-coded color function in template string. Import the token from @counter/tokens instead.',
      },
    ],
  },
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    '.next/',
    '.turbo/',
    'coverage/',
    '*.config.js',
    '*.config.cjs',
    '*.config.mjs',
  ],
};
