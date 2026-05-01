module.exports = {
  root: false,
  extends: ['@counter/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // RN does not need React in scope for JSX.
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
  },
};
