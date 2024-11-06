// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { type ProcessingOptions } from '../core/base_types';
import {
  ProcessedStudy,
  StudyPriority,
  priorityToText,
} from '../core/study_processor';
import { Study } from '../proto/generated/study';
import { VariationsSeed } from '../proto/generated/variations_seed';
import { writeStudyFile } from '../seed_tools/utils/study_json_utils';
import { downloadUrl, getSeedPath, getStudyPath } from './node_utils';

export async function fetchChromeSeedData(): Promise<Buffer> {
  const kChromeSeedUrl =
    'https://clientservices.googleapis.com/chrome-variations/seed';
  return await downloadUrl(kChromeSeedUrl);
}

// Groups studies by name and priority.
export function groupStudies(
  seedData: Buffer,
  options: ProcessingOptions,
): Record<string, Study[]> {
  const map: Record<string, Study[]> = {};
  const seed = VariationsSeed.fromBinary(seedData);
  const addStudy = (path: string, study: Study) => {
    const list = map[path];
    if (list !== undefined) list.push(study);
    else map[path] = [study];
  };

  for (const study of seed.study) {
    const sanitizedName = path
      .normalize(study.name)
      .replace(/^(\.\.(\/|\\|$))+/, '');
    const processed = new ProcessedStudy(study, options);
    processed.postProcessBeforeSerialization();
    addStudy(`all-by-name/${sanitizedName}`, study);
    if (!processed.studyDetails.isOutdated()) {
      const priority = processed.getPriority();
      if (priority > StudyPriority.NON_INTERESTING)
        addStudy(`${priorityToText(priority)}/${sanitizedName}`, study);
    }
  }
  return map;
}

// Makes a new git commit (if we have changes), returns the hash.
export function commitAllChanges(directory: string): string | undefined {
  const utcDate = new Date().toUTCString();
  const diff = execSync('git status --porcelain', { cwd: directory });
  if (diff.length <= 2) {
    console.log('Nothing to commit');
    return undefined;
  }
  execSync('git add -A', { cwd: directory });
  execSync(`git commit -m "Update seed ${utcDate}"`, { cwd: directory });
  const sha1 = execSync('git rev-parse HEAD', { cwd: directory })
    .toString()
    .trim();
  console.log('Changes committed, new commit hash', sha1);

  return sha1;
}

// Processes and serializes a given seed to disk (including grouping to
// subdirectories/files).
export async function storeDataToDirectory(
  seedData: Buffer,
  directory: string,
  options: ProcessingOptions,
): Promise<void> {
  const studyDirectory = getStudyPath(directory);
  fs.rmSync(studyDirectory, { recursive: true, force: true });
  const map = groupStudies(seedData, options);

  for (const [name, study] of Object.entries(map)) {
    const fileName = `${studyDirectory}/${name}.json5`;
    const dirname = path.dirname(fileName);
    fs.mkdirSync(dirname, { recursive: true });
    await writeStudyFile(study, fileName, { isChromium: !options.isBraveSeed });
  }

  // TODO: maybe start to use s3 instead of git one day?
  fs.writeFileSync(getSeedPath(directory), seedData);
}
