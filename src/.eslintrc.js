// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
module.exports = {
  extends: ['standard-with-typescript', 'prettier'],
  plugins: ['prettier', 'licenses'],

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
