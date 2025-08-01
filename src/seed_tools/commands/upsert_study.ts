// Copyright (c) 2025 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { Command } from '@commander-js/extra-typings';
import { basename, resolve } from 'path';

import { parseStudies, writeStudyFile } from '../utils/study_json_utils';

export default function createCommand() {
  return new Command('upsert_study')
    .description('Create or update a study file')
    .argument('<name>', 'study name')
    .argument('<enable_feature>', 'feature to enable')
    .argument(
      '<probability_enabled>',
      'probability for a user to receive the study',
      parseInt,
    )
    .argument('<channel>', 'channels to enable the study on')
    .argument('<platform>', 'platforms to enable the study on')
    .argument('[min_version]', 'minimum version to enable the study on', {})
    .action(main);
}

interface Options {
  min_version?: string;
}

async function main(
  name: string,
  enableFeature: string,
  probabilityEnabled: number,
  channel: string,
  platform: string,
  options: Options,
) {
  const studyName = basename(name);
  if (studyName !== name) {
    throw new Error(
      `Invalid study name '${name}'. Only simple filenames are allowed.`,
    );
  }

  const study: Record<string, any> = {
    name: studyName,
    experiment: [
      {
        name: 'Enabled',
        probability_weight: probabilityEnabled,
        feature_association: { enable_feature: [enableFeature] },
      },
      {
        name: 'Default',
        probability_weight: 100 - probabilityEnabled,
      },
    ],
    filter: {
      channel: channel.split(','),
      platform: platform.split(','),
    },
  };

  if (options?.min_version !== undefined) {
    study.filter.min_version = options.min_version;
  }

  const filename = resolve('studies', `${studyName}.json5`);

  // Verify correct format via round-trip parse
  const studies = parseStudies(JSON.stringify([study]));
  await writeStudyFile(studies, filename);

  console.log(filename);
}
