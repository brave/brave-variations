// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from 'commander';
import * as diff from 'diff';
import * as fs from 'fs-extra';
import { VariationsSeed } from '../../proto/generated/variations_seed';

export function createCommand(): Command {
  return new Command('compare_seeds')
    .description('Compare two seed.bin')
    .argument('<seed1_file>', 'seed1 file')
    .argument('<seed2_file>', 'seed2 file')
    .action(main);
}

async function main(seed1File: string, seed2File: string) {
  const seed1Content = VariationsSeed.fromBinary(fs.readFileSync(seed1File));
  const seed2Content = VariationsSeed.fromBinary(fs.readFileSync(seed2File));

  const seed1Json = VariationsSeed.toJson(seed1Content, {
    emitDefaultValues: false,
    enumAsInteger: false,
    useProtoFieldName: true,
  });

  const seed2Json = VariationsSeed.toJson(seed2Content, {
    emitDefaultValues: false,
    enumAsInteger: false,
    useProtoFieldName: true,
  });

  const seed1JsonString = JSON.stringify(seed1Json, null, 2);
  const seed2JsonString = JSON.stringify(seed2Json, null, 2);

  if (seed1JsonString !== seed2JsonString) {
    console.error('Seeds are different');
    console.error(
      diff.createTwoFilesPatch(
        seed1File,
        seed2File,
        seed1JsonString,
        seed2JsonString,
      ),
    );
    process.exit(1);
  }

  console.log('Seeds are the same');
}
