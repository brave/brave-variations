// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { variations as proto } from '../proto/generated/proto_bundle';

export function getPlatformNameFromString(protoPlatfrom: string): string {
  const PREFIX = 'PLATFORM_';
  if (protoPlatfrom.startsWith(PREFIX))
    return protoPlatfrom.substring(PREFIX.length);
  return protoPlatfrom;
}

export function getPlatfromName(protoPlatfrom: proto.Study.Platform): string {
  return getPlatformNameFromString(proto.Study.Platform[protoPlatfrom]);
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

function secondToUTCString(unixTimeSeconds: number): string {
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

export function studyToJSON(study: proto.IStudy): Record<string, any> {
  const msg = proto.Study.fromObject(study);
  const json = msg.toJSON();
  const filter = json.filter;
  delete json.consistency;
  delete json.activation_type;
  if (filter !== undefined) {
    if (filter.end_date !== undefined)
      filter.end_date = secondToUTCString(filter.end_date);
    if (filter.start_date !== undefined) {
      filter.start_date = secondToUTCString(filter.start_date);
    }
    filter.platform = serializePlatforms(filter.platform);
    filter.channel = serializeChannels(filter.channel);
  }
  return json;
}
