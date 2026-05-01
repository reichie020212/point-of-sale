module.exports = {
  root: false,
  extends: ['@counter/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // React 19 / Next 14 don't require importing React for JSX. The TS
    // checker enforces JSX correctness; our base rule treats unused
    // imports as errors, which catches stale React imports.
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    {
      files: ['middleware.ts', 'app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      rules: {
        // Next App Router server components are async by design.
        '@typescript-eslint/no-misused-promises': 'off',
      },
    },
  ],
};
