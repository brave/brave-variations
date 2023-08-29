module.exports = {
  'extends': ['standard-with-typescript', 'prettier'],
  root: true,
  parserOptions: {
    project: './tsconfig-lint.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    'core/generated/*',
    '.eslintrc.js',
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
