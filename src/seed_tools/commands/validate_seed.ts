// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { promises as fs } from 'fs';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import * as seed_validation from '../utils/seed_validation';
import * as study_validation from '../utils/study_validation';

export default new Command('validate_seed')
  .description('Validates seed.bin')
  .argument('<seed_file>', 'path to a seed protobuf')
  .action(main);

async function main(seedFilePath: string) {
  const variationsSeed = VariationsSeed.fromBinary(
    await fs.readFile(seedFilePath, { encoding: null }),
  );
  const errors = [];
  for (const study of variationsSeed.study) {
    const filePath = `${study.name}.json`;
    for (const error of study_validation.validateStudyReturnErrors(
      study,
      filePath,
    )) {
      errors.push(error);
    }
  }

  for (const error of seed_validation.validateSeedReturnErrors(
    variationsSeed,
  )) {
    errors.push(error);
  }

  console.log('Seed studies count:', variationsSeed.study.length);
  if (errors.length > 0) {
    console.error(`Seed validation errors:\n${errors.join('\n---\n')}`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}
