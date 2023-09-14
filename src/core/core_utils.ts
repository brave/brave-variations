// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { variations as proto } from '../proto/generated/proto_bundle';

export enum SeedType {
  PRODUCTION,
  STAGING,
  UPSTREAM,
}

export class ProcessingOptions {
  minMajorVersion: number;
}

export const variationsProductionUrl = 'production_seed';
export const variationsStagingUrl = 'staging_seed';
export const variationsUpstreamUrl = 'chrome_seed';

export const kGetUsedChromiumVersion = 'chromium.version.txt';

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

export function getChannelNameFromString(
  protoChannel: string,
  isBraveSpecific: boolean,
): string {
  if (isBraveSpecific) {
    if (protoChannel === 'STABLE') return 'RELEASE';
    if (protoChannel === 'CANARY') return 'NIGHTLY';
  }
  return protoChannel;
}

export function getChannelName(
  protoChannel: proto.Study.Channel,
  isBraveSpecific: boolean,
): string {
  return getChannelNameFromString(
    proto.Study.Channel[protoChannel],
    isBraveSpecific,
  );
}

export function getPlatformNameFromString(protoPlatfrom: string): string {
  const PREFIX = 'PLATFORM_';
  if (protoPlatfrom.startsWith(PREFIX))
    return protoPlatfrom.substring(PREFIX.length);
  return protoPlatfrom;
}

export function getPlatfromName(protoPlatfrom: proto.Study.Platform): string {
  return getPlatformNameFromString(proto.Study.Platform[protoPlatfrom]);
}
