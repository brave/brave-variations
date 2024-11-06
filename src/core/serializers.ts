// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { Study, Study_Channel, Study_Platform } from '../proto/generated/study';

export function getPlatformNameFromString(protoPlatfrom: string): string {
  const PREFIX = 'PLATFORM_';
  if (protoPlatfrom.startsWith(PREFIX))
    return protoPlatfrom.substring(PREFIX.length);
  return protoPlatfrom;
}

export function getPlatfromName(protoPlatfrom: Study_Platform): string {
  return getPlatformNameFromString(Study_Platform[protoPlatfrom]);
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
  protoChannel: Study_Channel,
  isBraveSpecific: boolean,
): string {
  return getChannelNameFromString(Study_Channel[protoChannel], isBraveSpecific);
}

function unixSecondToUTCString(unixTimeSeconds: number): string {
  return new Date(unixTimeSeconds * 1000).toUTCString();
}

export function serializePlatforms(platforms?: string[]): string | undefined {
  if (platforms === undefined) return undefined;
  return platforms.map((v) => getPlatformNameFromString(v)).join(', ');
}

export function serializeChannels(channels?: string[]): string | undefined {
  if (channels === undefined) return undefined;
  return channels.join(', ');
}

// Converts a study to JSON that is ready to be serialized. Some field are
// removed, some are converted to a human readable format.
export function studyToJSON(study: Study): Record<string, any> {
  const json = Study.toJson(study) as Record<string, any> | null;
  if (json === null) {
    throw new Error('Failed to convert study to JSON');
  }
  const filter = json.filter;
  delete json.consistency;
  delete json.activation_type;
  if (filter !== undefined) {
    if (filter.end_date !== undefined)
      filter.end_date = unixSecondToUTCString(filter.end_date);
    if (filter.start_date !== undefined) {
      filter.start_date = unixSecondToUTCString(filter.start_date);
    }
    filter.platform = serializePlatforms(filter.platform);
    filter.channel = serializeChannels(filter.channel);
  }
  return json;
}
