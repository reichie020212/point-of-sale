/**
 * @counter/tokens is the single source of truth for color literals.
 * The repo-wide no-restricted-syntax rules forbid hard-coded colors
 * everywhere else; this override allows them here, where they MUST live.
 */
module.exports = {
  root: false,
  extends: ['@counter/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    'no-restricted-syntax': 'off',
  },
};
