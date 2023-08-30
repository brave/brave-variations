module.exports = {
  extends: ['standard-with-typescript', 'prettier'],
  plugins: ['prettier'],

  root: true,
  parserOptions: {
    project: './tsconfig-lint.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    'proto/generated/*',
    'node_modules/*',
    'web/static/*',
    'finch_tracker/build/*',
  ],
  rules: {
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        printWidth: 80,
      },
    ],
  },
};
