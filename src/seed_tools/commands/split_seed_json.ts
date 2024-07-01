// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { promises as fs } from 'fs';
import DefaultMap from '../../base/containers/default_map';
import { type Study } from '../../proto/generated/study';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import * as study_json_utils from '../utils/study_json_utils';

export default new Command('split_seed_json')
  .description('Split seed.json into study files')
  .argument('<seed_json_path>', 'path to seed.json')
  .argument('<output_dir>', 'output directory')
  .action(main);

async function main(seedPath: string, outputDir: string) {
  const seedJson = preprocessSeedJson(
    JSON.parse(await fs.readFile(seedPath, 'utf8')),
  );

  // Parse the seed as protobuf json representation. The parse will fail if any
  // unknown fields or values are present in the json.
  const parsedSeed = VariationsSeed.fromJson(seedJson, {
    ignoreUnknownFields: false,
  });

  const studies = new DefaultMap<string, Study[]>(() => []);
  for (const study of parsedSeed.study) {
    studies.get(study.name).push(study);
  }

  await fs.mkdir(outputDir, { recursive: true });

  // Remove all files in the output directory.
  const dirEntries = await fs.readdir(outputDir, { withFileTypes: true });
  for (const dirEntry of dirEntries) {
    if (dirEntry.isFile()) {
      await fs.unlink(`${outputDir}/${dirEntry.name}`);
    }
  }

  // Write study files.
  for (const study of studies) {
    const studyName = study[0];
    const studyArray = study[1];
    const studyFile = `${outputDir}/${studyName}.json`;
    await study_json_utils.writeStudyFile(studyArray, studyFile);
  }
}

function preprocessSeedJson(json: any): any {
  json.study = json.studies;
  delete json.studies;

  for (const study of json.study) {
    if (study.experiments !== undefined) {
      study.experiment = study.experiments;
      delete study.experiments;
    }
    for (const experiment of study.experiment) {
      if (experiment.parameters !== undefined) {
        experiment.param = experiment.parameters;
        delete experiment.parameters;
      }
    }
    if (study.filter !== undefined) {
      if (study.filter.channel !== undefined) {
        study.filter.channel = study.filter.channel.map((channel: string) => {
          switch (channel) {
            case 'NIGHTLY':
              return 'CANARY';
            case 'RELEASE':
              return 'STABLE';
            default:
              return channel;
          }
        });
      }
      if (study.filter.platform !== undefined) {
        study.filter.platform = study.filter.platform.map(
          (platform: string) => {
            return 'PLATFORM_' + platform;
          },
        );
      }
    }
  }

  return json;
}
