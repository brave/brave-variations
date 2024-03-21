// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { Command } from 'commander';
import * as compare_seeds from './compare_seeds';
import * as create_seed from './create_seed';
import * as split_seed_json from './split_seed_json';

const program = new Command();

program.name('seed_tools').description('Seed tools');

compare_seeds.registerCommand(program);
create_seed.registerCommand(program);
split_seed_json.registerCommand(program);

program.parse();
