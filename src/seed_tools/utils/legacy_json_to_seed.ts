// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import DefaultMap from '../../base/containers/default_map';
import { type Study } from '../../proto/generated/study';
import { VariationsSeed } from '../../proto/generated/variations_seed';

export function parseLegacySeedJson(seedContent: string): {
  parsedSeed: VariationsSeed;
  studiesMap: DefaultMap<string, Study[]>;
} {
  const seedJson = preprocessSeedJson(JSON.parse(seedContent));

  // Parse the seed as protobuf json representation. The parse will fail if any
  // unknown fields or values are present in the json.
  const parsedSeed = VariationsSeed.fromJson(seedJson, {
    ignoreUnknownFields: false,
  });

  const studiesMap = new DefaultMap<string, Study[]>(() => []);
  for (const study of parsedSeed.study) {
    studiesMap.get(study.name).push(study);
  }

  return { parsedSeed, studiesMap };
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