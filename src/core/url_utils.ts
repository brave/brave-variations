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

function makeSourceGraphUrl(query: string, repo: string, file: string) {
  return (
    `https://sourcegraph.com/search?q=context:global` +
    `+${encodeURIComponent(query)}` +
    `+repo:${encodeURIComponent(repo)}` +
    `+file:${encodeURIComponent(file)}`
  );
}

export function getFeatureSearchUrl(feature: string): string {
  const BRAVE_CORE_OR_CHROME_REPO_PATTERN =
    '^(github\\.com/brave/brave-core|github\\.com/chromium/chromium)$';
  const FILES_WITH_FEATURES = '.*(.cc|.h|.mm)(.patch)?';

  return makeSourceGraphUrl(
    `/(BASE_FEATURE|BASE_DECLARE_FEATURE)` +
      `\\((\\s*\\w+,)?\\s*(k|\\")?${feature}(Feature)?(\\")?\\s*(,|\\))/`,
    BRAVE_CORE_OR_CHROME_REPO_PATTERN,
    FILES_WITH_FEATURES,
  );
}

export function getGitHubStorageUrl(): string {
  return 'https://github.com/brave/finch-data-private';
}

export function getGitHubStudyConfigUrl(
  study: string,
  seedType: SeedType,
): string {
  const BRAVE_VARIATIONS_REPO_PATTERN = '^github\\.com/brave/brave-variations$';
  if (seedType === SeedType.UPSTREAM)
    return `${getGitHubStorageUrl()}/blob/main/study/all-by-name/${study}`;
  const branch = seedType === SeedType.PRODUCTION ? 'production' : 'main';
  return makeSourceGraphUrl(
    `"name": "${study}"`,
    `${BRAVE_VARIATIONS_REPO_PATTERN}@${branch}`,
    'seed/seed.json',
  );
}

export function getGriffinUiUrl(study: string): string {
  return `https://griffin.brave.com/?seed=UPSTREAM&search=${study}`;
}
