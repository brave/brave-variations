// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export const spawnAsync = promisify(spawn);
