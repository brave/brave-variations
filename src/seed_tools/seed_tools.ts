// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';

import compare_seeds from './commands/compare_seeds';
import create_seed from './commands/create_seed';
import split_seed_json from './commands/split_seed_json';

program
  .name('seed_tools')
  .description('Seed tools for manipulating study files.')
  .addCommand(compare_seeds())
  .addCommand(create_seed())
  .addCommand(split_seed_json())
  .parse();
