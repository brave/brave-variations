// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { execSync } from 'child_process';
import { assert } from 'console';
import { existsSync, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

export default function createCommand() {
  return new Command('compare_python_gen')
    .description(
      'Run python and typescript seed generators and compare results',
    )
    .option('--python <value>', 'Path to python executable', 'python3')
    .action(main);
}

interface Options {
  python: string;
}

async function main(options: Options) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-compare-'));
  const mockSerialNumber = 'mock_serial_number';

  try {
    const pythonSeedFilePath = path.join(tempDir, 'python_seed.bin');
    const typescriptSeedFilePath = path.join(tempDir, 'typescript_seed.bin');
    const pythonSeedSerialNumberFilePath = path.join(
      tempDir,
      'python_serialnumber',
    );
    const typescriptSeedSerialNumberFilePath = path.join(
      tempDir,
      'typescript_serialnumber',
    );

    // Run Python seed generator
    execSync(
      `${options.python} ./seed/serialize.py ./seed/seed.json --mock_serial_number ${mockSerialNumber}`,
      {
        stdio: 'inherit',
      },
    );
    // Move generated seed.bin and serialnumber to temporary directory.
    await moveFile('./seed.bin', pythonSeedFilePath);
    await moveFile('./serialnumber', pythonSeedSerialNumberFilePath);

    // Run TypeScript seed generator
    execSync(
      `npm run seed_tools create ./studies ${typescriptSeedFilePath} -- --mock_serial_number ${mockSerialNumber} --output_serial_number_file ${typescriptSeedSerialNumberFilePath}`,
      { stdio: 'inherit' },
    );

    // Run seed comparator
    execSync(
      `npm run seed_tools compare_seeds ${pythonSeedFilePath} ${typescriptSeedFilePath} ${pythonSeedSerialNumberFilePath} ${typescriptSeedSerialNumberFilePath}`,
      { stdio: 'inherit' },
    );
  } finally {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function moveFile(src: string, dest: string) {
  await fs.copyFile(src, dest);
  await fs.unlink(src);
  assert(!existsSync(src));
}
