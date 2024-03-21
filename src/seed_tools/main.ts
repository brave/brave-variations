// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { program } from 'commander';
import * as compare_seeds from './commands/compare_seeds';
import * as create_seed from './commands/create_seed';
import * as split_seed_json from './commands/split_seed_json';

program
  .name('seed_tools')
  .description('Seed tools')
  .addCommand(compare_seeds.createCommand())
  .addCommand(create_seed.createCommand())
  .addCommand(split_seed_json.createCommand());

program.parse();
