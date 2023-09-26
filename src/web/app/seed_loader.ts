// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { variations as proto } from '../../proto/generated/proto_bundle';
import { SeedType, type ProcessingOptions } from '../../core/base_types';
import { StudyListModel, StudyModel } from './study_model';
import { ProcessedStudy } from '../../core/study_processor';

import * as url_utils from '../../core/url_utils';

const getCurrentMajorVersion = new Promise<number>((resolve) => {
  loadFile(url_utils.getUsedChromiumVersionUrl, 'text')
    .then((chromeVersionData) => {
      if (chromeVersionData !== undefined)
        resolve(chromeVersionData.split('.')[0] ?? 0);
      resolve(0);
    })
    .catch(() => {
      resolve(0);
    });
});

async function loadFile(
  url: string,
  responseType: 'arraybuffer' | 'text',
): Promise<any> {
  return await new Promise<any | undefined>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true /* async */);
    xhr.responseType = responseType;
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error('HTTP status:' + xhr.status));
      }
    };
    xhr.onerror = (err) => {
      reject(err);
    };
    xhr.send(null);
  });
}

async function loadSeedFromUrl(url: string, type: SeedType) {
  const data = await loadFile(url, 'arraybuffer');
  const seedBytes = new Uint8Array(data);
  const seed = proto.VariationsSeed.decode(seedBytes);
  const isBrave = type !== SeedType.UPSTREAM;

  // Desktop/Android could use a different major chrome version.
  // Use -1 version for Brave studies to make sure that we don't cut
  // anything important.
  const minMajorVersion = (await getCurrentMajorVersion) - (isBrave ? 1 : 0);
  const options: ProcessingOptions = { minMajorVersion };
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
  loadSeedFromUrl(url_utils.variationsProductionUrl, SeedType.PRODUCTION)
    .then(cb.bind(cb, SeedType.PRODUCTION))
    .catch(console.error);
  loadSeedFromUrl(url_utils.variationsStagingUrl, SeedType.STAGING)
    .then(cb.bind(cb, SeedType.STAGING))
    .catch(console.error);
  loadSeedFromUrl(url_utils.variationsUpstreamUrl, SeedType.UPSTREAM)
    .then(cb.bind(cb, SeedType.UPSTREAM))
    .catch(() => {
      /* ignore an error, a non-public endpoint */
    });
}
