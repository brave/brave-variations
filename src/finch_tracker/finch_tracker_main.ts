// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as fs from 'fs';
import * as path from 'path';
import { Command } from '@commander-js/extra-typings';
import { variations as proto } from '../proto/generated/proto_bundle';
import { downloadUrl, getSeedPath, getStudyPath } from './node_utils';
import {
  ProcessedStudy,
  StudyPriority,
  priorityToText,
} from '../core/study_processor';
import { makeSummary, summaryToJson } from '../core/summary';
import { studyToJSON } from '../core/serializers';
import { execSync } from 'child_process';
import {
  kGetUsedChromiumVersion,
  type ProcessingOptions,
} from '../core/core_utils';

async function fetchChromeSeedData(): Promise<Buffer> {
  const kChromeSeedUrl =
    'https://clientservices.googleapis.com/chrome-variations/seed';
  return await downloadUrl(kChromeSeedUrl);
}

function serializeStudiesToDirectory(
  seedData: Buffer,
  directory: string,
  options: ProcessingOptions,
): void {
  const seed = proto.VariationsSeed.decode(seedData);
  const exps = new Map<string, unknown[]>();
  let cnt = 0;
  const addStudy = (path: string, study: proto.IStudy) => {
    const json = studyToJSON(study);
    const list = exps.get(path);
    if (list !== undefined) list.push(json);
    else exps.set(path, [json]);
    cnt++;
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

  console.log(`${cnt} studies processed`);
  for (const [name, json] of exps) {
    const fileName = `${directory}/${name}`;
    const dirname = path.dirname(fileName);
    fs.mkdirSync(dirname, { recursive: true });
    fs.writeFileSync(fileName, JSON.stringify(json, null, 2) + '\n');
  }
}

function commitAllChanges(directory: string): string | undefined {
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

function storeDataToDirectory(
  seedData: Buffer,
  directory: string,
  options: ProcessingOptions,
): void {
  const studyDirectory = getStudyPath(directory);
  fs.rmSync(studyDirectory, { recursive: true, force: true });
  serializeStudiesToDirectory(seedData, studyDirectory, options);

  // TODO: maybe use s3 instead of git?
  fs.writeFileSync(getSeedPath(directory), seedData);
}

async function main(): Promise<void> {
  const program = new Command()
    .description('Chrome finch tracker')
    .version('0.0.1')
    .argument('<finch_storage>', 'A path to a repository to store Finch data')
    .argument(
      '[current_seed_file]',
      'Explicitly set the current seed file.' +
        'By default the file is downloaded from the backend.',
    )
    .argument(
      '[previous_seed_file]',
      'Explicitly set the previous seed file.' +
        '<finch_storage>/seed.bin is used by default.',
    )
    .option(
      '-m, --chrome-major <number>',
      'Override the current stable major chrome version.' +
        'By default the version is taken from the backend' +
        '(see kGetUsedChromiumVersion)',
      parseInt,
    )
    .option('--no-update', "Don't make any disk changes")
    .option('--no-commit', "Just update <finch_storage>, don't create a commit")
    .option('-o --output <file>', 'A file to create a summary')
    .parse();

  const storageDir = program.args[0];
  const seedFile = program.args[1];
  const previousSeedFile = program.args[2];
  let minMajorVersion = program.opts().chromeMajor;

  if (minMajorVersion === undefined) {
    const chromiumVersionData = await downloadUrl(kGetUsedChromiumVersion);
    const chromiumVersionString = chromiumVersionData?.toString().split('.')[0];
    if (chromiumVersionString === undefined) {
      program.error(
        'Failed to get the Chromium version via ' + kGetUsedChromiumVersion,
      );
      return;
    }
    console.log('Got Chromium version', chromiumVersionString);
    minMajorVersion = parseInt(chromiumVersionString);
  }

  const options: ProcessingOptions = {
    minMajorVersion,
  };

  const outputFile = program.opts().output;
  const createSummary = outputFile !== undefined;
  const updateData = program.opts().update;
  const commitData = program.opts().commit && updateData;

  if (!createSummary && !updateData) {
    program.error('Nothing to do.');
    return;
  }

  const seedData =
    seedFile !== undefined
      ? fs.readFileSync(seedFile)
      : await fetchChromeSeedData();
  const seed = proto.VariationsSeed.decode(seedData);
  let previousSeedData: Buffer | undefined;
  let newGitSha1: string | undefined;

  if (createSummary) {
    previousSeedData = fs.readFileSync(
      previousSeedFile ?? getSeedPath(storageDir),
    );
  }

  if (updateData) {
    storeDataToDirectory(seedData, storageDir, options);
    if (commitData) {
      newGitSha1 = commitAllChanges(storageDir);
    }
  }

  if (createSummary && previousSeedData !== undefined) {
    const previousSeed = proto.VariationsSeed.decode(previousSeedData);
    const summary = makeSummary(
      previousSeed,
      seed,
      options,
      StudyPriority.STABLE_MIN,
    );
    const summaryJSON = summaryToJson(summary, newGitSha1);
    if (summaryJSON !== undefined) {
      fs.writeFileSync(outputFile, summaryJSON);
    } else {
      console.log('empty summary.');
    }
  }
}

void main();
