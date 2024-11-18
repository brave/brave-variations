// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { promises as fs } from 'fs';
import { parseLegacySeedJson } from '../utils/legacy_json_to_seed';
import * as study_json_utils from '../utils/study_json_utils';

export default function createCommand() {
  return new Command('split_seed_json')
    .description('Split seed.json into study files')
    .argument('<seed_json_path>', 'path to seed.json')
    .argument('<output_dir>', 'output directory')
    .action(main);
}

async function main(seedPath: string, outputDir: string) {
  const seedContent = await fs.readFile(seedPath, 'utf8');
  const { studiesMap } = parseLegacySeedJson(seedContent);
  await fs.mkdir(outputDir, { recursive: true });

  // Remove all files in the output directory.
  const dirEntries = await fs.readdir(outputDir, { withFileTypes: true });
  for (const dirEntry of dirEntries) {
    if (dirEntry.isFile()) {
      await fs.unlink(`${outputDir}/${dirEntry.name}`);
    }
  }

  // Write study files.
  for (const study of studiesMap) {
    const studyName = study[0];
    const studyArray = study[1];
    const studyFile = `${outputDir}/${studyName}.json5`;
    await study_json_utils.writeStudyFile(studyArray, studyFile);
  }
}
