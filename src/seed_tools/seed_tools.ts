// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';

import auto_rollout from './commands/auto_rollout';
import compare_python_gen from './commands/compare_python_gen';
import compare_seeds from './commands/compare_seeds';
import create from './commands/create';
import diff_finch_seeds from './commands/diff_finch_seeds';
import lint from './commands/lint';
import split_seed_json from './commands/split_seed_json';

program
  .name('seed_tools')
  .description('Seed tools for manipulating study files.')
  .addCommand(auto_rollout())
  .addCommand(compare_python_gen())
  .addCommand(compare_seeds())
  .addCommand(create())
  .addCommand(lint())
  .addCommand(split_seed_json())
  .addCommand(diff_finch_seeds())
  .parse();
