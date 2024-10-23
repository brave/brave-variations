// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { readStudiesToSeed } from '../utils/studies_to_seed';

export default function createCommand() {
  return new Command('lint')
    .description('Lint study files without creating seed.bin')
    .argument(
      '[studies_dir]',
      'path to the directory containing study files',
      'studies',
    )
    .option('--fix', 'fix format errors in-place')
    .action(lintStudies);
}

interface Options {
  fix?: true;
}

async function lintStudies(studiesDir: string, options: Options) {
  const { variationsSeed, errors } = await readStudiesToSeed(
    studiesDir,
    options.fix,
  );

  if (errors.length > 0) {
    console.error(`Lint errors:\n${errors.join('\n---\n')}`);
    process.exit(1);
  }

  console.log('Lint successful. Study count:', variationsSeed.study.length);
}
