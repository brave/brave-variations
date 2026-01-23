// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const licenses = require('eslint-plugin-licenses');
const react = require('eslint-plugin-react');
const { defineConfig, globalIgnores } = require('eslint/config');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    settings: {
      react: {
        version: 'detect',
      },
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parserOptions: {
        project: '../tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },

    extends: compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended-type-checked',
      'plugin:@typescript-eslint/stylistic-type-checked',
      'prettier',
      'plugin:react/recommended',
    ),

    plugins: {
      licenses,
      react,
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',

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
  },
  globalIgnores(['**/build/', 'proto/generated/', 'src/web/public/bundle/']),
  {
    extends: compat.extends('plugin:@typescript-eslint/disable-type-checked'),
    files: ['**/*.js'],
  },
  {
    files: ['**/*.test.ts'],

    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['src/eslint.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
