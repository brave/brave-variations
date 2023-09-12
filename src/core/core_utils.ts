// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { variations as proto } from '../proto/generated/proto_bundle';

export class ProcessingOptions {
  minMajorVersion: number;
}

export const variationsProductionUrl = 'https://variations.brave.com/seed';
export const variationsStagingUrl = 'https://variations.bravesoftware.com/seed';

export const kGetUsedChromiumVersion =
  'https://versions.brave.com/latest/release-windows-x64-chromium.version';

export function getFeatureSearchUrl(feature: string): string {
  return (
    'https://sourcegraph.com/search?q=context:global+repo:%28github%5C.com/' +
    'brave/brave-core%24%7C%5Egithub%5C.com/chromium/chromium%24%29+/' +
    'BASE_FEATURE%5C%28%5Cs*%5Cw*%2C%5Cs*%22' +
    feature +
    '%22/+file:.*%28.cc%7C.h%7C.mm%7C.java%29%28.patch%29*&' +
    'patternType=standard&sm=1&groupBy=repo'
  );
}

export function getGitHubStorageUrl(): string {
  return 'https://github.com/atuchin-m/finch-data-private';
}

export function getGitHubStudyConfigUrl(study: string): string {
  return `${getGitHubStorageUrl()}/blob/main/study/all-by-name/${study}`;
}

export function getGriffinUiUrl(study: string): string {
  return `https://griffin.brave.com/?seed=UPSTREAM&name=${study}`;
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
