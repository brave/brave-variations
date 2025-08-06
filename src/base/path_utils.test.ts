// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as fs from 'fs';
import assert from 'node:assert';
import { test } from 'node:test';
import * as path from 'path';
import * as path_utils from './path_utils';

const isWin32 = process.platform === 'win32';

test('wsPath', () => {
  const packageJsonPath = path_utils.wsPath('//package.json');
  assert.strictEqual(fs.existsSync(packageJsonPath), true);
  assert.strictEqual(
    packageJsonPath,
    path.normalize(path.join(path_utils.rootDir, 'package.json')),
  );
});

test('asPosix', () => {
  if (isWin32) {
    assert.strictEqual(path_utils.asPosix('foo\\bar'), 'foo/bar');
  }
  assert.strictEqual(path_utils.asPosix('foo/bar'), 'foo/bar');
  assert.strictEqual(path_utils.asPosix('foo//bar'), 'foo/bar');
});
