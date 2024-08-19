// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';

import check_study from './commands/check_study';
import compare_seeds from './commands/compare_seeds';
import create_seed from './commands/create_seed';
import split_seed_json from './commands/split_seed_json';
import validate_seed_pb from './commands/validate_seed_pb';

program
  .name('seed_tools')
  .description('Seed tools for manipulating study files.')
  .addCommand(check_study)
  .addCommand(compare_seeds)
  .addCommand(create_seed)
  .addCommand(split_seed_json)
  .addCommand(validate_seed_pb)
  .parse();
