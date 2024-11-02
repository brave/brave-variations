// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { wsPath } from 'src/base/path_utils';
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

export async function readStudiesToSeed(
  studiesDir: string,
  fix = false,
  revision?: string,
): Promise<{
  variationsSeed: VariationsSeed;
  errors: string[];
}> {
  const { studies, studyFileBaseNameMap, errors } = revision
    ? await readStudiesAtRevision(studiesDir, revision)
    : await readStudiesFromDirectory(studiesDir, fix);
  const variationsSeed: VariationsSeed = {
    study: studies,
    layers: [],
  };

  errors.push(
    ...seed_validation.getSeedErrors(variationsSeed, studyFileBaseNameMap),
  );

  return { variationsSeed, errors };
}

async function readStudiesFromDirectory(
  studiesDir: string,
  fix: boolean,
): Promise<{
  studies: Study[];
  studyFileBaseNameMap: Map<Study, string>;
  errors: string[];
}> {
  const files = (await fs.readdir(studiesDir)).sort();

  const filesWithContent = [];
  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    filesWithContent.push({ path: filePath, content });
  }

  return await readStudies(filesWithContent, fix);
}

async function readStudiesAtRevision(
  studiesDir: string,
  revision: string,
): Promise<{
  studies: Study[];
  studyFileBaseNameMap: Map<Study, string>;
  errors: string[];
}> {
  const basePath = wsPath('//');
  studiesDir = path.relative(basePath, studiesDir);
  const files = execSync(`git show ${revision}:${studiesDir}`, {
    encoding: 'utf8',
  }).split('\n');

  const filesWithContent = [];
  for (const file of files) {
    if (!file.endsWith('.json5')) continue;
    const content = execSync(`git show ${revision}:"${studiesDir}/${file}"`, {
      encoding: 'utf8',
    });
    filesWithContent.push({ path: file, content });
  }

  return await readStudies(filesWithContent, false);
}

async function readStudies(
  files: { path: string; content: string }[],
  fix: boolean,
): Promise<{
  studies: Study[];
  studyFileBaseNameMap: Map<Study, string>;
  errors: string[];
}> {
  files = files.sort();

  const studies: Study[] = [];
  const studyFileBaseNameMap = new Map<Study, string>();
  const errors: string[] = [];

  for (const file of files) {
    const readStudyFileResult = study_json_utils.parseStudyFile(
      file.path,
      file.content,
    );
    errors.push(...readStudyFileResult.errors);
    if (readStudyFileResult.errors.length === 0) {
      errors.push(
        ...(await checkAndOptionallyFixFormat(
          file.path,
          readStudyFileResult.studies,
          file.content,
          fix,
        )),
      );
    }
    if (readStudyFileResult.errors.length > 0) {
      continue;
    }
    for (const study of readStudyFileResult.studies) {
      setStudyDefaultParameters(study);
      studies.push(study);
      studyFileBaseNameMap.set(study, file_utils.getFileBaseName(file.path));
    }
  }

  return { studies, studyFileBaseNameMap, errors };
}

async function checkAndOptionallyFixFormat(
  studyFilePath: string,
  studies: Study[],
  studyArrayString: string,
  fix: boolean,
): Promise<string[]> {
  const errors: string[] = [];
  const stringifiedStudies = study_json_utils.stringifyStudies(studies);
  if (stringifiedStudies !== studyArrayString) {
    if (fix) {
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
