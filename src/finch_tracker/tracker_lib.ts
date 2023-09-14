// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { variations as proto } from '../proto/generated/proto_bundle';
import { downloadUrl, getSeedPath, getStudyPath } from './node_utils';
import {
  ProcessedStudy,
  StudyPriority,
  priorityToText,
} from '../core/study_processor';
import { studyToJSON } from '../core/serializers';
import { type ProcessingOptions } from '../core/base_types';

export async function fetchChromeSeedData(): Promise<Buffer> {
  const kChromeSeedUrl =
    'https://clientservices.googleapis.com/chrome-variations/seed';
  return await downloadUrl(kChromeSeedUrl);
}

export function serializeStudies(
  seedData: Buffer,
  options: ProcessingOptions,
): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  const seed = proto.VariationsSeed.decode(seedData);
  const addStudy = (path: string, study: proto.IStudy) => {
    const json = studyToJSON(study);
    const list = map[path];
    if (list !== undefined) list.push(json);
    else map[path] = [json];
  };

  for (const study of seed.study) {
    const name = study.name;
    const processed = new ProcessedStudy(study, options);
    processed.postProcessBeforeSerialization();
    addStudy(path.join('all-by-name', name), study);
    if (!processed.studyDetails.isOutdated()) {
      const priority = processed.getPriority();
      if (priority > StudyPriority.NON_INTERESTING)
        addStudy(path.join(priorityToText(priority), name), study);
    }
  }
  return map;
}

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

export function storeDataToDirectory(
  seedData: Buffer,
  directory: string,
  options: ProcessingOptions,
): void {
  const studyDirectory = getStudyPath(directory);
  fs.rmSync(studyDirectory, { recursive: true, force: true });
  const map = serializeStudies(seedData, options);

  for (const [name, json] of Object.entries(map)) {
    const fileName = `${studyDirectory}/${name}`;
    const dirname = path.dirname(fileName);
    fs.mkdirSync(dirname, { recursive: true });
    fs.writeFileSync(fileName, JSON.stringify(json, null, 2) + '\n');
  }

  // TODO: maybe use s3 instead of git?
  fs.writeFileSync(getSeedPath(directory), seedData);
}
