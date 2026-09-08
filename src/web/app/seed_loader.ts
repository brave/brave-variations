// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { SeedType, type ProcessingOptions } from '../../core/base_types';
import { ProcessedStudy } from '../../core/study_processor';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import { StudyListModel, StudyModel } from './study_model';

import * as url_utils from '../../core/url_utils';

async function loadSeedFromUrl(url: string, type: SeedType) {
  const data = await (await fetch(url)).arrayBuffer();
  const seedBytes = new Uint8Array(data);
  const seed = VariationsSeed.fromBinary(seedBytes);
  const isBraveSeed = type !== SeedType.UPSTREAM;

  const minMajorVersion = await url_utils.GetChromiumVersionForBraveStable();
  const options: ProcessingOptions = { minMajorVersion, isBraveSeed };
  const studies: StudyModel[] = [];
  seed.study.forEach((study, index) => {
    const processed = new ProcessedStudy(study, options);
    const studyDetails = processed.studyDetails;
    if (studyDetails.isArchived || studyDetails.isBadStudyFormat) {
      return;
    }

    const uniqueId = type * 1000000 + index;
    studies.push(new StudyModel(processed, type, uniqueId));
  });
  return new StudyListModel(studies);
}

// Loads all available seeds asynchronously, updates React App state via the callback.
export function loadSeedDataAsync(
  cb: (type: SeedType, studyList: StudyListModel) => void,
) {
  loadSeedFromUrl(url_utils.variationsMainUrl, SeedType.MAIN)
    .then(cb.bind(cb, SeedType.MAIN))
    .catch(console.error);
  loadSeedFromUrl(url_utils.variationsUpstreamUrl, SeedType.UPSTREAM)
    .then(cb.bind(cb, SeedType.UPSTREAM))
    .catch(() => {
      /* ignore an error, a non-public endpoint */
    });
}
