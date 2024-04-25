// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import * as diff from 'diff';
import { promises as fs } from 'fs';
import DefaultMap from 'src/base/containers/default_map';
import { type Study } from '../../proto/generated/study';
import * as study_json_utils from '../utils/study_json_utils';
import * as study_validation from '../utils/study_validation';

export default new Command('check_study')
  .description('Check study files for logic and format errors')
  .argument('<study_files...>', 'study files')
  .option('--fix', 'fix format errors in-place')
  .action(main);

interface Options {
  fix?: true;
}

async function main(studyFilePaths: string[], options: Options) {
  const errorsPerFile = new DefaultMap<string, string[]>(() => []);
  for (const studyFilePath of studyFilePaths) {
    const readStudyFileResult =
      await study_json_utils.readStudyFileReturnWithError(studyFilePath);
    if (!readStudyFileResult.ok) {
      errorsPerFile.get(studyFilePath).push(readStudyFileResult.error.message);
      continue;
    }

    const [studies, studyArrayString] = readStudyFileResult.value;
    for (const study of studies) {
      const studyErrors = study_validation.validateStudyReturnErrors(
        study,
        studyFilePath,
      );
      if (studyErrors.length > 0) {
        errorsPerFile.get(studyFilePath).push(...studyErrors);
      }
    }

    const formatErrors = await checkAndOptionallyFixFormat(
      studyFilePath,
      studies,
      studyArrayString,
      options,
    );
    if (formatErrors.length > 0) {
      errorsPerFile.get(studyFilePath).push(...formatErrors);
    }
  }

  for (const [studyFilePath, errors] of errorsPerFile.entries()) {
    console.error(`Errors in ${studyFilePath}:\n${errors.join('\n---\n')}`);
  }

  if (errorsPerFile.size > 0) {
    process.exit(1);
  }
}

async function checkAndOptionallyFixFormat(
  studyFilePath: string,
  studies: Study[],
  studyArrayString: string,
  options: Options,
): Promise<string[]> {
  const errors: string[] = [];
  const stringifiedStudyArray = study_json_utils.stringifyStudyArray(studies);
  if (stringifiedStudyArray !== studyArrayString) {
    if (options.fix) {
      await fs.writeFile(studyFilePath, stringifiedStudyArray);
    } else {
      errors.push(
        `Format required:\n` +
          diff.createTwoFilesPatch(
            studyFilePath,
            studyFilePath + '.formatted',
            studyArrayString,
            stringifiedStudyArray,
          ),
      );
    }
  }
  return errors;
}
