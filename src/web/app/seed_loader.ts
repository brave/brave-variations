// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { SeedType, type ProcessingOptions } from '../../core/base_types';
import { ProcessedStudy } from '../../core/study_processor';
import { variations as proto } from '../../proto/generated/proto_bundle';
import { StudyListModel, StudyModel } from './study_model';

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
  return await new Promise<any>((resolve, reject) => {
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
    xhr.onerror = () => {
      reject(new Error('XHR error'));
    };
    xhr.send(null);
  });
}

async function loadSeedFromUrl(url: string, type: SeedType) {
  const data = await loadFile(url, 'arraybuffer');
  const seedBytes = new Uint8Array(data);
  const seed = proto.VariationsSeed.decode(seedBytes);
  const isBraveSeed = type !== SeedType.UPSTREAM;

  // Desktop/Android could use a different major chrome version.
  // Use -1 version for Brave studies to make sure that we don't cut
  // anything important.
  const minMajorVersion =
    (await getCurrentMajorVersion) - (isBraveSeed ? 1 : 0);
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
