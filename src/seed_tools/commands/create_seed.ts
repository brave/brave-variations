// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from 'commander';
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  Study_ActivationType,
  Study_Consistency,
  type Study,
} from '../../proto/generated/study';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import * as study_json_utils from './../utils/study_json_utils';

export function createCommand(): Command {
  return new Command('create_seed')
    .description('Create seed.bin from study files')
    .argument('<studies_dir>', 'path to a directory containing study files')
    .argument('<output_file>', 'output seed file')
    .option(
      '--mock_serial_number <value>',
      'mock serial number for testing purposes',
    )
    .option(
      '--serial_number_path <path>',
      'mock serial number for testing purposes',
    )
    .action(main);
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

  const serialNumber = getSerialNumber(options.mock_serial_number);
  const variationsSeed: VariationsSeed = {
    serialNumber,
    study: [],
    layers: [],
    version: '1',
  };

  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const fileNameWithoutExtension = path.basename(file, '.json');
    const studyArray = study_json_utils.readStudyArray(filePath);
    for (const study of studyArray) {
      validateStudy(fileNameWithoutExtension, study);
      setStudyFixedParameters(study);
      variationsSeed.study.push(study);
    }
  }

  const seedBinary = VariationsSeed.toBinary(variationsSeed);
  fs.writeFileSync(outputFile, seedBinary);
  if (options.serial_number_path !== undefined) {
    fs.writeFileSync(options.serial_number_path, serialNumber);
  }
}

function getSerialNumber(mockSerialNumber: string | undefined): string {
  if (mockSerialNumber !== undefined) {
    return mockSerialNumber;
  }
  const timestamp = String(Date.now());
  const hash = createHash('md5').update(timestamp).digest('hex');
  return hash;
}

function validateStudy(fileNameWithoutExtension: string, study: Study) {
  if (
    study.name !== fileNameWithoutExtension &&
    !study.name.startsWith(`${fileNameWithoutExtension}_`)
  ) {
    throw new Error(
      `Study name ${study.name} does not match file name ${fileNameWithoutExtension}`,
    );
  }

  const experimentNames = new Set<string>();
  let totalProbability = 0;
  for (const experiment of study.experiment) {
    // Validate experiment name.
    if (experiment.name === '') {
      throw new Error(`Experiment name is not defined for study ${study.name}`);
    }
    if (experimentNames.has(experiment.name)) {
      throw new Error(`Duplicate experiment name ${experiment.name}`);
    }
    experimentNames.add(experiment.name);

    totalProbability += experiment.probabilityWeight ?? 0;
  }

  if (totalProbability !== 100) {
    throw new Error(`Total probability is not 100 for study ${study.name}`);
  }
}

function setStudyFixedParameters(study: Study) {
  study.activationType = Study_ActivationType.ACTIVATE_ON_STARTUP;
  study.consistency = Study_Consistency.PERMANENT;
}
