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
import diffStrings from '../utils/diff_strings';
import * as file_utils from '../utils/file_utils';
import * as seed_validation from '../utils/seed_validation';
import * as study_json_utils from '../utils/study_json_utils';

export default function createCommand() {
  return new Command('create_seed')
    .description('Create seed.bin from study files')
    .argument('<studies_dir>', 'path to the directory containing study files')
    .argument(
      '[output_seed_file]',
      'output seed file, may be omitted if --validate_only is provided',
    )
    .option('--fix', 'fix format errors in-place')
    .option('--mock_serial_number <value>', 'mock serial number')
    .option(
      '--output_serial_number_file <path>',
      'file path to write the seed serial number',
      './serialnumber',
    )
    .option('--validate_only', 'validate the seed without creating it')
    .option('--version <value>', 'seed version to set')
    .action(main);
}

interface Options {
  fix?: true;
  mock_serial_number?: string;
  output_serial_number_file?: string;
  validate_only?: true;
  version?: string;
}

async function main(
  studiesDir: string,
  outputSeedFile: string | undefined,
  options: Options,
) {
  console.log(outputSeedFile, options);
  if (outputSeedFile === undefined && !options.validate_only) {
    console.error(
      'Either output_seed_file or --validate_only must be provided',
    );
    process.exit(1);
  }

  if (options.fix && outputSeedFile) {
    console.log(`outputSeedFile: "${outputSeedFile}"`);
    console.error(
      'The --fix option cannot be used when an output_seed_file is provided',
    );
    process.exit(1);
  }

  const { studies, studyFileBaseNameMap, errors } =
    await readStudiesFromDirectory(studiesDir, options);

  const variationsSeed: VariationsSeed = {
    study: studies,
    layers: [],
    version: options.version ?? '1',
  };

  const serialNumber =
    options.mock_serial_number ?? generateSerialNumber(variationsSeed);
  variationsSeed.serial_number = serialNumber;

  errors.push(
    ...seed_validation.getSeedErrors(variationsSeed, studyFileBaseNameMap),
  );

  if (errors.length > 0) {
    console.error(`Seed validation errors:\n${errors.join('\n---\n')}`);
    process.exit(1);
  }

  console.log('Seed study count:', variationsSeed.study.length);
  if (outputSeedFile !== undefined) {
    const seedBinary = VariationsSeed.toBinary(variationsSeed);
    await fs.writeFile(outputSeedFile, seedBinary);
    if (options.output_serial_number_file !== undefined) {
      await fs.writeFile(options.output_serial_number_file, serialNumber);
    }
    console.log(outputSeedFile, 'created with serial number', serialNumber);
  }
}

async function readStudiesFromDirectory(
  studiesDir: string,
  options: Options,
): Promise<{
  studies: Study[];
  studyFileBaseNameMap: Map<Study, string>;
  errors: string[];
}> {
  const files = (await fs.readdir(studiesDir)).sort();

  const studies: Study[] = [];
  const studyFileBaseNameMap = new Map<Study, string>();
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const readStudyFileResult = await study_json_utils.readStudyFile(filePath);
    errors.push(...readStudyFileResult.errors);
    errors.push(
      ...(await checkAndOptionallyFixFormat(
        filePath,
        readStudyFileResult.studies,
        readStudyFileResult.studyFileContent,
        options,
      )),
    );
    if (readStudyFileResult.errors.length > 0) {
      continue;
    }
    for (const study of readStudyFileResult.studies) {
      setStudyDefaultParameters(study);
      studies.push(study);
      studyFileBaseNameMap.set(study, file_utils.getFileBaseName(filePath));
    }
  }

  return { studies, studyFileBaseNameMap, errors };
}

async function checkAndOptionallyFixFormat(
  studyFilePath: string,
  studies: Study[],
  studyArrayString: string,
  options: Options,
): Promise<string[]> {
  const errors: string[] = [];
  const stringifiedStudies = study_json_utils.stringifyStudies(studies);
  if (stringifiedStudies !== studyArrayString) {
    if (options.fix) {
      await fs.writeFile(studyFilePath, stringifiedStudies);
    } else {
      errors.push(
        `Format required:\n` +
          (await diffStrings(
            studyArrayString,
            stringifiedStudies,
            studyFilePath,
            studyFilePath + '.formatted',
          )),
      );
    }
  }
  return errors;
}

function setStudyDefaultParameters(study: Study) {
  if (study.activation_type === undefined) {
    study.activation_type = Study_ActivationType.ACTIVATE_ON_STARTUP;
  }
  if (study.consistency === undefined) {
    study.consistency = Study_Consistency.PERMANENT;
  }
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
