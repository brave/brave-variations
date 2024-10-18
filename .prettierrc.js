// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// This file is located at the root level, rather than within the src/
// directory, to enable formatting for all files across the project, not just
// those within src/.

/** @type {import("prettier").Config} */
module.exports = {
  plugins: ['prettier-plugin-organize-imports'],
  singleQuote: true,
  overrides: [
    {
      files: '*.json',
      excludeFiles: 'tsconfig.json',
      options: {
        parser: 'json-stringify',
      },
    },
    {
      files: '*.json5',
      options: {
        // Sync with JSON5.stringify logic.
        plugins: ['prettier-plugin-multiline-arrays'],
        trailingComma: 'all',
      },
    },
  ],
};
