module.exports = {
  root: false,
  extends: ['@counter/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
