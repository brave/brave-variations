// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { Command } from '@commander-js/extra-typings';
import * as fs from 'fs';
import { type ProcessingOptions } from '../core/base_types';
import { StudyPriority } from '../core/study_processor';
import { makeSummary, summaryToJson } from '../core/summary';
import * as url_utils from '../core/url_utils';
import { variations as proto } from '../proto/generated/proto_bundle';
import { downloadUrl, getSeedPath } from './node_utils';
import {
  commitAllChanges,
  fetchChromeSeedData,
  storeDataToDirectory,
} from './tracker_lib';

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
        '(see getUsedChromiumVersionUrl)',
      parseInt,
    )
    .option('--no-update', "Don't make any disk changes")
    .option('--no-commit', "Just update <finch_storage>, don't create a commit")
    .option(
      '-o --output <file>',
      'A json file in slack mrkdwn format to output the summary',
    )
    .parse();

  const storageDir = program.args[0];
  const seedFile = program.args[1];
  const previousSeedFile = program.args[2];
  let minMajorVersion = program.opts().chromeMajor;

  if (minMajorVersion === undefined) {
    const chromiumVersionData = await downloadUrl(
      url_utils.getUsedChromiumVersionUrl,
    );
    const chromiumVersionString = chromiumVersionData?.toString().split('.')[0];
    if (chromiumVersionString === undefined) {
      program.error(
        'Failed to get the Chromium version from ' +
          url_utils.getUsedChromiumVersionUrl,
      );
      return;
    }
    console.log('Got Chromium version', chromiumVersionString);
    minMajorVersion = parseInt(chromiumVersionString);
  }

  const options: ProcessingOptions = {
    minMajorVersion,
    isBraveSeed: false,
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
    // Read the previous seed in advance, because the next step could update it.
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
      StudyPriority.STABLE_MIN, // the min priority we care in the summary.
    );
    const summaryJSON = summaryToJson(summary, newGitSha1);
    if (summaryJSON !== undefined) {
      fs.writeFileSync(outputFile, summaryJSON);
    } else {
      console.log('empty summary.');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error running command:');
    console.error(err);
    process.exit(1);
  });
