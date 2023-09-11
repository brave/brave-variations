// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
type VersionComponent = number | '*';
export class VersionPattern {
  v: [VersionComponent, VersionComponent, VersionComponent, VersionComponent];
}

export class Version {
  v: [number, number, number, number];
}

export function matchesMaxVersion(ver: Version, max: VersionPattern): boolean {
  for (let i = 0; i < 4; i++) {
    const pattern = max.v[i];
    if (pattern === '*') return true;
    if (ver.v[i] < pattern) return true;
    else if (ver.v[i] > pattern) return false;
  }
  return true;
}

export function parseVersionPattern(s: string): VersionPattern {
  const v = s.split('.', 4);
  const res: VersionPattern = { v: ['*', '*', '*', '*'] };
  for (let i = 0; i < 4; i++)
    if (v[i] !== undefined && v[i] !== '*') res.v[i] = parseInt(v[i]);

  return res;
}
