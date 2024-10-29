// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import { readStudiesToSeed } from '../utils/studies_to_seed';
import { retainMostProbableExperiments } from '../utils/perf_tools';

export default function createCommand() {
  return new Command('create')
    .description('Create seed.bin from study files')
    .argument(
      '[studies_dir]',
      'path to the directory containing study files',
      'studies',
    )
    .argument('[output_seed_file]', 'output seed file', 'seed.bin')
    .option('--mock_serial_number <value>', 'mock serial number')
    .option(
      '--output_serial_number_file <path>',
      'file path to write the seed serial number',
      './serialnumber',
    )
    .option(
      '--perf_mode',
      'Retains only the most probabble experiment in each study.' +
        'Used in the perf tests.',
    )
    .option('--version <value>', 'seed version to set')
    .action(createSeed);
}

interface Options {
  mock_serial_number?: string;
  output_serial_number_file: string;
  perf_mode?: boolean;
  version?: string;
}

async function createSeed(
  studiesDir: string,
  outputSeedFile: string,
  options: Options,
) {
  const { variationsSeed, errors } = await readStudiesToSeed(studiesDir, false);

  if (errors.length > 0) {
    console.error(`Seed validation errors:\n${errors.join('\n---\n')}`);
    process.exit(1);
  }

  const serialNumber =
    options.mock_serial_number ?? generateSerialNumber(variationsSeed);
  variationsSeed.serial_number = serialNumber;

  variationsSeed.version = options.version ?? '1';

  console.log('Seed study count:', variationsSeed.study.length);
  if (options.perf_mode) {
    retainMostProbableExperiments(variationsSeed);
  }
  const seedBinary = VariationsSeed.toBinary(variationsSeed);
  await fs.writeFile(outputSeedFile, seedBinary);
  await fs.writeFile(options.output_serial_number_file, serialNumber);
  console.log(outputSeedFile, 'created with serial number', serialNumber);
}

function generateSerialNumber(variationsSeed: VariationsSeed): string {
  const seedBinary = VariationsSeed.toBinary(variationsSeed);
  const timestamp = String(Date.now());
  const hash = createHash('md5')
    .update(seedBinary)
    .update(timestamp)
    .digest('hex');
  return hash;
}
