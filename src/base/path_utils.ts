// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const isWin32 = process.platform === 'win32';

const getCurrentDir = (): string => {
  const __filename = fileURLToPath(import.meta.url);
  const dir = dirname(__filename);
  // Use fs.realpathSync to normalize the path(it could be c:\.. or C:\..).
  return isWin32 ? fs.realpathSync.native(dir) : dir;
};

export const rootDir = path.normalize(path.join(getCurrentDir(), '../../'));

// Returns path in the workspace if starts with `//`. Workspace is the root
// directory containing `package.json`.
export function wsPath(p: string): string {
  if (p.startsWith('//')) {
    p = path.normalize(p.replace('//', rootDir));
  }
  return p;
}

export function asPosix(p: string): string {
  p = path.normalize(p);
  if (isWin32) {
    p = p.replace(/\\/g, '/');
  }
  return p;
}
