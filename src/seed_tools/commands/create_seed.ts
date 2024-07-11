// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  Study_ActivationType,
  Study_Consistency,
  type Study,
} from '../../proto/generated/study';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import * as seed_validation from '../utils/seed_validation';
import * as study_json_utils from '../utils/study_json_utils';
import * as study_validation from '../utils/study_validation';

export default new Command('create_seed')
  .description('Create seed.bin from study files')
  .argument('<studies_dir>', 'path to a directory containing study files')
  .argument('<output_file>', 'output seed file')
  .option('--version <value>', 'version to set into the seed')
  .option(
    '--serial_number_path <path>',
    'file path to write the serial number to',
    './serialnumber',
  )
  .option('--mock_serial_number <value>', 'mock serial number')
  .action(main);

interface Options {
  mock_serial_number?: string;
  serial_number_path?: string;
  version?: string;
}

async function main(studiesDir: string, outputFile: string, options: Options) {
  const files: string[] = [];
  for (const dirItem of await fs.readdir(studiesDir, { withFileTypes: true })) {
    if (!dirItem.isFile()) {
      continue;
    }
    files.push(dirItem.name);
  }
  files.sort();

  const variationsSeed: VariationsSeed = {
    study: [],
    layers: [],
    version: options.version ?? '1',
  };

  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const studies = await study_json_utils.readStudyFile(filePath);
    for (const study of studies) {
      study_validation.validateStudy(study, filePath);
      setStudyFixedParameters(study);
      variationsSeed.study.push(study);
    }
  }

  seed_validation.validateSeed(variationsSeed);

  const serialNumber =
    options.mock_serial_number ?? generateSerialNumber(variationsSeed);
  variationsSeed.serial_number = serialNumber;

  const seedBinary = VariationsSeed.toBinary(variationsSeed);
  await fs.writeFile(outputFile, seedBinary);
  if (options.serial_number_path !== undefined) {
    await fs.writeFile(options.serial_number_path, serialNumber);
  }
  console.log(outputFile, 'created with serial number', serialNumber);
  console.log('Study files count:', files.length);
  console.log('Seed studies count:', variationsSeed.study.length);
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

function setStudyFixedParameters(study: Study) {
  study.activation_type = Study_ActivationType.ACTIVATE_ON_STARTUP;
  study.consistency = Study_Consistency.PERMANENT;
}
