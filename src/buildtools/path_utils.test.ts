// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as path_utils from './path_utils';

const isWin32 = process.platform === 'win32';

test('wsPath', () => {
  const buildtools = path_utils.wsPath('//buildtools');
  expect(fs.existsSync(buildtools)).toBe(true);
  expect(buildtools).toBe(
    path.normalize(path.join(path_utils.rootDir, 'buildtools')),
  );
});

test('asPosix', () => {
  if (isWin32) {
    expect(path_utils.asPosix('foo\\bar')).toBe('foo//bar');
  }
  expect(path_utils.asPosix('foo/bar')).toBe('foo//bar');
  expect(path_utils.asPosix('foo//bar')).toBe('foo//bar');
});
