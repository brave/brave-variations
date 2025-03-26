// Copyright (c) 2025 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { gunzipSync } from 'zlib';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import diffStrings from '../utils/diff_strings';

export default function createCommand() {
  return new Command('diff_finch_seeds')
    .description('Compare two finch seeds')
    .argument('<seed1_revision>', 'seed1 revision')
    .argument('<seed2_revision>', 'seed2 revision')
    .action(main);
}

interface Options {}

async function main(
  seed1Revision: string,
  seed2Revision: string,
  options: Options,
) {
  const seed1 = await fetchSeed(seed1Revision);
  const seed2 = await fetchSeed(seed2Revision);

  const seed1Json = VariationsSeed.toJsonString(seed1, {
    useProtoFieldName: true,
    prettySpaces: 2,
  });
  const seed2Json = VariationsSeed.toJsonString(seed2, {
    useProtoFieldName: true,
    prettySpaces: 2,
  });

  const diff = await diffStrings(
    seed1Json,
    seed2Json,
    seed1Revision,
    seed2Revision,
  );
  console.log(diff);
}

async function fetchSeed(revision: string) {
  const response = await fetch(
    `https://chromium.googlesource.com/chromium-variations/+/${revision}/single_group_per_study_prefer_new_behavior/seed.json?format=text`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch seed for revision ${revision}`);
  }
  const base64Response = await response.text();
  const jsonString = Buffer.from(base64Response, 'base64').toString();
  const json = JSON.parse(jsonString);
  const compressedSeed = Buffer.from(json.variations_compressed_seed, 'base64');
  const decompressedSeed = gunzipSync(compressedSeed);
  const seed = VariationsSeed.fromBinary(decompressedSeed);
  return seed;
}
