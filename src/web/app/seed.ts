// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { variations as proto } from '../../proto/generated/proto_bundle';
import { SeedType } from '../../core/core_utils';
import { StudyListModel } from './models';
import * as core_utils from '../../core/core_utils';

async function loadFile(
  url: string,
  responseType: 'arraybuffer' | 'text',
): Promise<any> {
  return await new Promise<any | undefined>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true /* async */);
    xhr.responseType = responseType;
    xhr.onload = () => {
      resolve(xhr.response);
    };
    xhr.onerror = (err) => {
      reject(err);
    };
    xhr.send(null);
  });
}

const getCurrentMajorVersion = new Promise<number>((resolve) => {
  loadFile(core_utils.getUsedChromiumVersionUrl, 'text')
    .then((chromeVersionData) => {
      if (chromeVersionData !== undefined)
        resolve(chromeVersionData.split('.')[0] ?? 0);
      resolve(0);
    })
    .catch(console.error);
});

async function loadSeedFromUrl(url: string, type: SeedType) {
  const data = await loadFile(url, 'arraybuffer');
  const seedBytes = new Uint8Array(data);
  const seed = proto.VariationsSeed.decode(seedBytes);

  const options: core_utils.ProcessingOptions = {
    minMajorVersion: await getCurrentMajorVersion,
  };
  return new StudyListModel(seed.study, options, type);
}

export function loadSeedDataAsync(
  cb: (type: SeedType, studyList: StudyListModel) => void,
) {
  loadSeedFromUrl(core_utils.variationsProductionUrl, SeedType.PRODUCTION)
    .then(cb.bind(SeedType.PRODUCTION))
    .catch(console.error);
  loadSeedFromUrl(core_utils.variationsStagingUrl, SeedType.STAGING)
    .then(cb.bind(SeedType.STAGING))
    .catch(console.error);
  loadSeedFromUrl(core_utils.variationsUpstreamUrl, SeedType.UPSTREAM)
    .then(cb.bind(SeedType.UPSTREAM))
    .catch(() => {
      /* ignore an error */
    });
}
