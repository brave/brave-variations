// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

export function channelToString(channel: string, isChromium: boolean): string {
  if (isChromium) return channel;

  switch (channel) {
    case 'CANARY':
      return 'NIGHTLY';
    case 'STABLE':
      return 'RELEASE';
  }
  return channel;
}

export function platformToString(platform: string): string {
  return platform.replace(/^PLATFORM_/, '');
}
