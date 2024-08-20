// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

module.exports = {
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
    'plugin:react/recommended',
  ],
  plugins: ['licenses', 'react'],
  root: true,
  parserOptions: {
    project: '../tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['**/build/', '/proto/generated/', '/web/public/bundle/'],
  overrides: [
    {
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      files: ['**/*.js'],
    },
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/require-await': 'off',

    'licenses/header': [
      2,
      {
        tryUseCreatedYear: true,
        comment: {
          allow: 'both',
          prefer: 'line',
        },
        header: [
          'Copyright (c) {YEAR} The Brave Authors. All rights reserved.',
          'This Source Code Form is subject to the terms of the Mozilla Public',
          'License, v. 2.0. If a copy of the MPL was not distributed with this file,',
          'You can obtain one at https://mozilla.org/MPL/2.0/.',
        ],
      },
    ],
  },
};
