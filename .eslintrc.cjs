/**
 * Root ESLint config. Workspace packages extend this and add their own
 * environment-specific layers (e.g. next, react, node).
 */
module.exports = {
  root: true,
  extends: ['@counter/eslint-config'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
    // Design prototypes are read-only references — they intentionally use
    // hard-coded colors and HTML/JSX-via-Babel-standalone tricks that the
    // production stack does not.
    'src/',
    'web/',
    'shared/',
    'Counter POS.html',
    'Counter Web.html',
  ],
};
