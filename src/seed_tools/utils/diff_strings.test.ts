// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import diffStrings from './diff_strings';

describe('diffStrings', () => {
  it('should return the diff between two strings', async () => {
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

    expect(result).toContain(displayFileName1);
    expect(result).toContain(displayFileName2);
    expect(result).toContain('-Hello, world!');
    expect(result).toContain('+Hello, brave!');
  });

  it('should return empty diff between two equal strings', async () => {
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

    expect(result).toBe('');
  });
});
