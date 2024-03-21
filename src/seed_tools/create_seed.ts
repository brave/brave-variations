// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import type { Command } from 'commander';
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  Study_ActivationType,
  Study_Consistency,
} from '../proto/generated/study';
import { VariationsSeed } from '../proto/generated/variations_seed';
import * as study_seed from './study_json';

function getSerialNumber(mockSerialNumber: string | undefined): string {
  if (mockSerialNumber !== undefined) {
    return mockSerialNumber;
  }
  const timestamp = String(Date.now());
  const hash = createHash('md5').update(timestamp).digest('hex');
  return hash;
}

async function main(studiesDir: string, outputFile: string, options: any) {
  const files: string[] = [];
  for (const dirItem of fs.readdirSync(studiesDir, { withFileTypes: true })) {
    if (!dirItem.isFile()) {
      continue;
    }
    files.push(dirItem.name);
  }
  files.sort();

  const variationsSeed: VariationsSeed = {
    serialNumber: getSerialNumber(options.mock_serial_number),
    study: [],
    layers: [],
    version: '1',
  };

  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const studyArray = study_seed.readStudyArray(filePath);
    for (const study of studyArray) {
      study.activationType = Study_ActivationType.ACTIVATE_ON_STARTUP;
      study.consistency = Study_Consistency.PERMANENT;
      variationsSeed.study.push(study);
    }
  }

  const seedBinary = VariationsSeed.toBinary(variationsSeed);
  fs.writeFileSync(outputFile, seedBinary);
}

export function registerCommand(program: Command) {
  program
    .command('create_seed')
    .description('Create seed.bin from study files')
    .argument('<studies_dir>', 'path to a directory containing study files')
    .argument('<output_file>', 'output seed file')
    .option(
      '--mock_serial_number <value>',
      'mock serial number for testing purposes',
    )
    .action(main);
}
