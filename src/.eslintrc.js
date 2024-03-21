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
  extends: ['standard-with-typescript', 'prettier', 'plugin:react/recommended'],
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
