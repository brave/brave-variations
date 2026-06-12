// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import licenses from 'eslint-plugin-licenses';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    // Generated files
    '**/build/',
    'src/proto/generated/',
    'src/web/public/bundle/',
  ]),

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
      },
    },
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  eslintReact.configs.recommended,
  {
    plugins: {
      licenses,
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
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]);
