// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { SeedType } from './base_types';

export const variationsProductionUrl = 'https://variations.brave.com/seed';
export const variationsStagingUrl = 'https://variations.bravesoftware.com/seed';
export const variationsUpstreamUrl =
  'https://griffin.brave.com/finch-data-private/seed.bin';

export const getUsedChromiumVersionUrl =
  'https://versions.brave.com/latest/release-windows-x64-chromium.version';

export function getFeatureSearchUrl(feature: string): string {
  return (
    'https://sourcegraph.com/search?q=context:global+repo:%28%5Egithub%5C.com' +
    '/brave/brave-core%24%7C%5Egithub%5C.com/chromium/chromium%24%29+/' +
    '%28BASE_FEATURE%7CBASE_DECLARE_FEATURE%29%5C%28%5Cs*%5Cw*%2C%3F%5Cs*k%3F' +
    feature +
    '/+file:.*%28.cc%7C.h%7C.mm%7C.java%29%28.patch%29*&' +
    'patternType=standard&sm=1&groupBy=repo'
  );
}

export function getGitHubStorageUrl(): string {
  return 'https://github.com/brave/finch-data-private';
}

export function getGitHubStudyConfigUrl(
  study: string,
  seedType: SeedType,
): string {
  if (seedType === SeedType.UPSTREAM)
    return `${getGitHubStorageUrl()}/blob/main/study/all-by-name/${study}`;
  const branch = seedType === SeedType.PRODUCTION ? 'production' : 'main';
  return (
    `https://sourcegraph.com/search?q=context:global+repo:%5Egithub%5C.com/` +
    `brave/brave-variations%24%40${branch}+%22name%22:+%22${study}` +
    `%22++file:seed/seed.json&patternType=standard&sm=1&groupBy=repo`
  );
}

export function getGriffinUiUrl(study: string): string {
  return `https://griffin.brave.com/?seed=UPSTREAM&search=${study}`;
}
