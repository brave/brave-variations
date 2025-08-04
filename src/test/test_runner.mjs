// Copyright (c) 2025 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const targetDir = 'src/';
let testFiles = [];
for (const item of readdirSync(targetDir, { recursive: true })) {
  if (item.endsWith('.test.ts')) {
    testFiles.push(path.join(targetDir, item));
  }
}
const res = spawnSync('node', ['--import', 'tsx', '--test', ...testFiles], {
  stdio: 'inherit',
});
process.exit(res.status);
