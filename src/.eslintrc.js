module.exports = {
  'extends': ['standard-with-typescript', 'prettier'],
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
    'max-len': [
      'error',
      {
        'code': 80,
        'tabWidth': 2,
        'ignoreUrls': true,
        'ignoreTemplateLiterals': true
      }
    ]
  }
};
