// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { Study_Channel, Study_Platform } from '../proto/generated/study';

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
