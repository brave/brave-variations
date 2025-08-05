// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'node:assert';
import { describe, test } from 'node:test';
import diffStrings from './diff_strings';

describe('diffStrings', async () => {
  await test('should return the diff between two strings', async () => {
    const string1 = 'Hello, world!';
    const string2 = 'Hello, brave!';
    const displayFileName1 = 'file1-test.txt';
    const displayFileName2 = 'file2-test.txt';

    const result = await diffStrings(
      string1,
      string2,
      displayFileName1,
      displayFileName2,
    );

    assert.ok(
      result.includes(displayFileName1),
      `Expected result to contain ${displayFileName1}`,
    );
    assert.ok(
      result.includes(displayFileName2),
      `Expected result to contain ${displayFileName2}`,
    );
    assert.ok(
      result.includes('-Hello, world!'),
      `Expected result to contain '-Hello, world!'`,
    );
    assert.ok(
      result.includes('+Hello, brave!'),
      `Expected result to contain '+Hello, brave!'`,
    );
  });

  await test('should return empty diff between two equal strings', async () => {
    const string1 = 'Hello, brave!';
    const string2 = 'Hello, brave!';
    const displayFileName1 = 'file1-test.txt';
    const displayFileName2 = 'file2-test.txt';

    const result = await diffStrings(
      string1,
      string2,
      displayFileName1,
      displayFileName2,
    );

    assert.strictEqual(result, '');
  });
});
